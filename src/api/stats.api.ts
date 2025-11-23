import { IStatItem, Levels } from '../types/stats.types';
import { AdStatsDatabase } from '../dbs/stats.indexed.db.ts';
import { checkDatabaseExists } from '../utils.ts';

import { Observable, fromEventPattern } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { DATABASE_NAME } from '../features/stats/stats.const.ts';

interface IHierarchyStatItem extends IStatItem {
  id?: number;
  level: Levels;
  parentSupplier?: string;
  parentBrand?: string;
  parentType?: string;
}

class StatsApi {
  private getRequestId() {
    return Math.random().toString(36).substring(2, 15);
  }

  private worker: Worker;
  private resolvedMessages = new Map<string, IStatItem[]>();
  private db: AdStatsDatabase | null = null;
  private onProgress?: (progress: string) => void;

  constructor() {
    this.worker = new Worker(new URL('./mock.ts', import.meta.url));
    this.worker.onmessage = (event) => {
      switch (event.data.action) {
        case 'getStatsData':
          this.resolvedMessages.set(event.data.requestId, event.data.result);
          break;
      }
    };
  }
  private sendMessageToWorker(messageData: {
    action: string;
    size?: number;
    requestId: string;
  }) {
    this.worker.postMessage(messageData);
  }
  private request(messageData: { action: string; size?: number }) {
    const requestId = this.getRequestId();
    return new Promise<IStatItem[]>((resolve) => {
      this.sendMessageToWorker({ ...messageData, requestId });

      setInterval(() => {
        if (this.resolvedMessages.has(requestId)) {
          resolve(this.resolvedMessages.get(requestId)!);
          this.resolvedMessages.delete(requestId);
        }
      }, 1000);
    });
  }

  public async initializeDatabase(size: number = 1e5): Promise<void> {
    if (!this.db) {
      this.db = new AdStatsDatabase();
    }

    console.log('get data from api...');
    const rawData = await this.request({ action: 'getStatsData', size });

    const hierarchyItems: IHierarchyStatItem[] = [];

    const suppliers = new Set<string>();
    const brands = new Map<string, Set<string>>();
    const types = new Map<string, Set<string>>();

    for (const item of rawData) {
      suppliers.add(item.supplier);

      const brandKey = item.supplier;
      if (!brands.has(brandKey)) brands.set(brandKey, new Set());
      brands.get(brandKey)!.add(item.brand);

      const typeKey = `${item.supplier}|${item.brand}`;
      if (!types.has(typeKey)) types.set(typeKey, new Set());
      types.get(typeKey)!.add(item.type);
    }

    for (const supplier of suppliers) {
      hierarchyItems.push({
        level: Levels.supplier,
        supplier,
        brand: '',
        type: '',
        article: '',
        cost: [],
        orders: [],
        returns: [],
        lastUpdate: new Date().toISOString(),
      });
    }

    for (const [supplier, brandSet] of brands) {
      for (const brand of brandSet) {
        hierarchyItems.push({
          level: Levels.brand,
          supplier,
          brand,
          type: '',
          article: '',
          parentSupplier: supplier,
          cost: [],
          orders: [],
          returns: [],
          lastUpdate: new Date().toISOString(),
        });
      }
    }

    for (const [typeKey, typeSet] of types) {
      const [supplier, brand] = typeKey.split('|');
      for (const type of typeSet) {
        hierarchyItems.push({
          level: Levels.type,
          supplier,
          brand,
          type,
          article: '',
          parentSupplier: supplier,
          parentBrand: brand,
          cost: [],
          orders: [],
          returns: [],
          lastUpdate: new Date().toISOString(),
        });
      }
    }

    for (const item of rawData) {
      hierarchyItems.push({
        ...item,
        level: Levels.article,
        parentSupplier: item.supplier,
        parentBrand: item.brand,
        parentType: item.type,
      });
    }

    console.log('add data to base');
    await this.safeBulkAddWithProgress(hierarchyItems);
    console.log(`base length: ${hierarchyItems.length}`);
  }

  public async getHierarchyData(params: {
    level: number;
    parentSupplier?: string;
    parentBrand?: string;
    parentType?: string;
  }): Promise<IHierarchyStatItem[]> {
    const isBaseExist = await checkDatabaseExists(DATABASE_NAME);
    if (isBaseExist) {
      this.db = new AdStatsDatabase();
    }
    if (!this.db) {
      console.log('init base');
      await this.initializeDatabase(1e5);
    }

    const { level, parentSupplier, parentBrand, parentType } = params;

    console.log('base length', await this.db!.stats.count());

    switch (level) {
      case 0: // Suppliers
        return await this.db!.stats.where('level')
          .equals(Levels.supplier)
          .toArray();

      case 1: // Brands for supplier
        if (!parentSupplier)
          throw new Error('parentSupplier required for level 1');
        return await this.db!.stats.where('[level+parentSupplier]')
          .equals([Levels.brand, parentSupplier])
          .toArray();

      case 2: // Types for supplier+brand
        if (!parentSupplier || !parentBrand)
          throw new Error(
            'parentSupplier and parentBrand required for level 2',
          );
        return await this.db!.stats.where('[level+parentSupplier+parentBrand]')
          .equals([Levels.type, parentSupplier, parentBrand])
          .toArray();

      case 3: // Articles for supplier+brand+type
        if (!parentSupplier || !parentBrand || !parentType)
          throw new Error('All parent fields required for level 3');
        return await this.db!.stats.where(
          '[level+parentSupplier+parentBrand+parentType]',
        )
          .equals([Levels.article, parentSupplier, parentBrand, parentType])
          .toArray();

      default:
        return [];
    }
  }

  public getShort(): Promise<IStatItem[]> {
    return this.request({ action: 'getStatsData', size: 1000 });
  }

  public getFull(): Promise<IStatItem[]> {
    return this.request({ action: 'getStatsData' });
  }

  public getVersion(): Promise<number> {
    return new Promise((resolve) => {
      resolve(1);
    });
  }

  private async safeBulkAddWithProgress(
    items: IHierarchyStatItem[],
    chunkSize = 8000,
  ) {
    if (!this.db) {
      return;
    }
    let successfulAdds = 0;
    let failedAdds = 0;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      try {
        await this.db.stats.bulkAdd(chunk);
        successfulAdds += chunk.length;
      } catch (error) {
        if (error.name === 'ConstraintError') {
          for (const item of chunk) {
            try {
              await this.db.stats.add(item);
              successfulAdds++;
            } catch (e) {
              failedAdds++;
            }
          }
        } else {
          failedAdds += chunk.length;
          console.error('Bulk add error:', error);
        }
      }

      const progress = (((i + chunk.length) / items.length) * 100).toFixed(1);
      this.onProgress?.(`${progress}`);
      console.log(
        `Progress: ${progress}% | Success: ${successfulAdds} | Failed: ${failedAdds}`,
      );

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    return { successfulAdds, failedAdds };
  }

  public getStatsStream(): Observable<{ data: IStatItem[]; isNext: boolean }> {
    this.sendMessageToWorker({
      action: 'getStatsStream',
      size: 100000,
      requestId: this.getRequestId(),
    });

    return fromEventPattern<MessageEvent>(
      (handler) => this.worker.addEventListener('message', handler),
      (handler) => this.worker.removeEventListener('message', handler),
    ).pipe(
      filter((event) => {
        return event.data.action === 'getStatsStream';
      }),
      map((event) => ({
        data: event.data.payload as IStatItem[],
        isNext: event.data.isNext,
      })),
    );
  }

  public setProgressCallback(callback: (progress: string) => void) {
    this.onProgress = callback;
  }
}

export const STATS_API = new StatsApi();
