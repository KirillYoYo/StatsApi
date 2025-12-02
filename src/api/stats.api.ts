import { IStatItem, IStatItemRaw, Levels } from '../types/stats.types';
import { AdStatsDatabase } from '../dbs/stats.indexed.db.ts';
import { checkDatabaseExists } from '../utils.ts';

import { Observable, fromEventPattern } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { DATABASE_NAME } from '../features/stats/stats.const.ts';

interface IHierarchyStatItem extends IStatItem {
  id?: number;
  level: Levels;
  childCount: number;
  parentSupplier?: string;
  parentBrand?: string;
  parentType?: string;
  revenue?: number[];
  buyouts?: number[];
  totalCost?: number;
  totalOrders?: number;
  totalReturns?: number;
  totalRevenue?: number;
  totalBuyouts?: number;
}

interface WorkerMessage {
  action: string;
  requestId: string;
  size?: number;
  result?: IStatItem[];
  payload?: IStatItem[];
  isNext?: boolean;
}

class StatsApi {
  private getRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private worker: Worker;
  private resolvedMessages = new Map<string, IStatItem[]>();
  private db: AdStatsDatabase | null = null;
  private onProgress?: (progress: string) => void;
  public rawData: IStatItemRaw[];

  constructor() {
    this.worker = new Worker(new URL('./mock.ts', import.meta.url));
    this.worker.onmessage = (event) => {
      switch (event.data.action) {
        case 'getStatsData':
          this.resolvedMessages.set(event.data.requestId, event.data.result);
          break;
      }
    };
    this.rawData = [];
  }

  private sendMessageToWorker(messageData: {
    action: string;
    size?: number;
    requestId: string;
  }): void {
    this.worker.postMessage(messageData);
  }

  private request(messageData: {
    action: string;
    size?: number;
  }): Promise<IStatItem[]> {
    const requestId = this.getRequestId();
    return new Promise<IStatItem[]>((resolve) => {
      this.sendMessageToWorker({ ...messageData, requestId });

      const interval = setInterval(() => {
        if (this.resolvedMessages.has(requestId)) {
          const result = this.resolvedMessages.get(requestId)!;
          this.resolvedMessages.delete(requestId);
          clearInterval(interval);
          resolve(result);
        }
      }, 100);
    });
  }

  public async initializeDatabase(size: number = 1e5): Promise<void> {
    if (!this.db) {
      this.db = new AdStatsDatabase();
    }

    this.onProgress?.(`getting data...`);
    console.log('get data from api...');
    const rawData: IStatItemRaw[] = await this.request({
      action: 'getStatsData',
      size,
    });

    this.rawData = rawData;

    const hierarchyItems: IHierarchyStatItem[] = [];

    const suppliers = new Set<string>();
    const brands = new Map<string, Set<string>>();
    const types = new Map<string, Set<string>>();
    const articles = new Map<string, Set<string>>();

    const supplierTotalChildren = new Map<string, number>();
    const brandTotalChildren = new Map<string, number>();
    const typeTotalChildren = new Map<string, number>();

    // Первый проход: собираем базовую структуру
    for (const item of rawData) {
      suppliers.add(item.supplier);

      const brandKey = item.supplier;
      if (!brands.has(brandKey)) brands.set(brandKey, new Set());
      brands.get(brandKey)!.add(item.brand);

      const typeKey = `${item.supplier}|${item.brand}`;
      if (!types.has(typeKey)) types.set(typeKey, new Set());
      types.get(typeKey)!.add(item.type);

      const articleKey = `${item.supplier}|${item.brand}|${item.type}`;
      if (!articles.has(articleKey)) articles.set(articleKey, new Set());
      articles.get(articleKey)!.add(item.article);
    }

    // Второй проход: подсчитываем общее количество потомков для каждого типа
    for (const [typeKey, typeSet] of types) {
      const [supplier, brand] = typeKey.split('|');
      for (const type of typeSet) {
        const articleKey = `${supplier}|${brand}|${type}`;
        const articleCount = articles.has(articleKey)
          ? articles.get(articleKey)!.size
          : 0;

        const typeFullKey = `${supplier}|${brand}|${type}`;
        typeTotalChildren.set(typeFullKey, articleCount);
      }
    }

    // Второй проход: подсчитываем общее количество потомков для каждого бренда
    for (const [supplier, brandSet] of brands) {
      for (const brand of brandSet) {
        let brandTotal = 0;
        const typeKey = `${supplier}|${brand}`;

        if (types.has(typeKey)) {
          for (const type of types.get(typeKey)!) {
            const typeFullKey = `${supplier}|${brand}|${type}`;
            brandTotal += 1;
            brandTotal += typeTotalChildren.get(typeFullKey) || 0;
          }
        }

        const brandFullKey = `${supplier}|${brand}`;
        brandTotalChildren.set(brandFullKey, brandTotal);
      }
    }

    // Второй проход: подсчитываем общее количество потомков для каждого поставщика
    for (const supplier of suppliers) {
      let supplierTotal = 0;

      if (brands.has(supplier)) {
        for (const brand of brands.get(supplier)!) {
          const brandFullKey = `${supplier}|${brand}`;
          supplierTotal += 1;
          supplierTotal += brandTotalChildren.get(brandFullKey) || 0;
        }
      }

      supplierTotalChildren.set(supplier, supplierTotal);
    }

    // Создаем элементы с подсчитанными childCount
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
        childCount: supplierTotalChildren.get(supplier) || 0,
      });
    }

    for (const [supplier, brandSet] of brands) {
      for (const brand of brandSet) {
        const brandFullKey = `${supplier}|${brand}`;
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
          childCount: brandTotalChildren.get(brandFullKey) || 0,
        });
      }
    }

    for (const [typeKey, typeSet] of types) {
      const [supplier, brand] = typeKey.split('|');
      for (const type of typeSet) {
        const typeFullKey = `${supplier}|${brand}|${type}`;
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
          childCount: typeTotalChildren.get(typeFullKey) || 0,
        });
      }
    }

    for (const item of rawData) {
      const articleItem: IHierarchyStatItem = {
        ...item,
        article: `ART_${item.article}`,
        level: Levels.article,
        parentSupplier: item.supplier,
        parentBrand: item.brand,
        parentType: item.type,
        childCount: 0,
      };

      hierarchyItems.push(this.calculateDerivedMetrics(articleItem));
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
      await this.initializeDatabase(1e5);
    }

    const { level, parentSupplier, parentBrand, parentType } = params;

    switch (level) {
      case 0:
        return await this.db!.stats.where('level')
          .equals(Levels.supplier)
          .toArray();

      case 1:
        if (!parentSupplier)
          throw new Error('parentSupplier required for level 1');
        return await this.db!.stats.where('[level+parentSupplier]')
          .equals([Levels.brand, parentSupplier])
          .toArray();

      case 2:
        if (!parentSupplier || !parentBrand)
          throw new Error(
            'parentSupplier and parentBrand required for level 2',
          );
        return await this.db!.stats.where('[level+parentSupplier+parentBrand]')
          .equals([Levels.type, parentSupplier, parentBrand])
          .toArray();

      case 3:
        if (!parentSupplier || !parentBrand || !parentType)
          throw new Error('All parent fields required for level 3');
        const articles = await this.db!.stats.where(
          '[level+parentSupplier+parentBrand+parentType]',
        )
          .equals([Levels.article, parentSupplier, parentBrand, parentType])
          .toArray();

        return articles.map((article) => this.calculateDerivedMetrics(article));

      default:
        return [];
    }
  }

  // ... остальные методы aggregateToSuppliers, aggregateToBrands, aggregateToTypes, calculateDerivedMetrics и т.д.

  // Методы aggregateTo* можно при необходимости удалить, если они точно не нужны в запросах

  private calculateDerivedMetrics(
    item: IHierarchyStatItem,
  ): IHierarchyStatItem {
    item.revenue = item.cost!.map((cost, index) => {
      const orders = item.orders![index] || 0;
      const returns = item.returns![index] || 0;
      const buyouts = orders - returns;
      return cost * buyouts;
    });

    item.buyouts = item.orders!.map(
      (orders, i) => orders - (item.returns![i] || 0),
    );

    item.totalCost = item.cost!.reduce((sum, val) => sum + val, 0);
    item.totalOrders = item.orders!.reduce((sum, val) => sum + val, 0);
    item.totalReturns = item.returns!.reduce((sum, val) => sum + val, 0);
    item.totalRevenue = item.revenue!.reduce((sum, val) => sum + val, 0);
    item.totalBuyouts = item.buyouts!.reduce((sum, val) => sum + val, 0);

    return item;
  }

  private async safeBulkAddWithProgress(
    items: IHierarchyStatItem[],
    chunkSize = 8000,
  ): Promise<{ successfulAdds: number; failedAdds: number } | void> {
    if (!this.db) {
      return;
    }
    this.onProgress?.(`${0}`);
    let successfulAdds = 0;
    let failedAdds = 0;

    for (let i = 0; i < items.length; i += chunkSize) {
      const chunk = items.slice(i, i + chunkSize);

      try {
        await this.db.stats.bulkAdd(chunk);
        successfulAdds += chunk.length;
      } catch (error: any) {
        if (error.name === 'ConstraintError') {
          for (const item of chunk) {
            try {
              await this.db!.stats.add(item);
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
      this.onProgress?.(progress);
      console.log(
        `Progress: ${progress}% | Success: ${successfulAdds} | Failed: ${failedAdds}`,
      );

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    return { successfulAdds, failedAdds };
  }

  public getStatsStream(): Observable<{ data: IStatItem[]; isNext: boolean }> {
    const requestId = this.getRequestId();
    this.sendMessageToWorker({
      action: 'getStatsStream',
      size: 100000,
      requestId,
    });

    return fromEventPattern<MessageEvent<WorkerMessage>>(
      (handler) => this.worker.addEventListener('message', handler),
      (handler) => this.worker.removeEventListener('message', handler),
    ).pipe(
      filter((event) => {
        return event.data.action === 'getStatsStream';
      }),
      map((event) => ({
        data: event.data.payload as IStatItem[],
        isNext: event.data.isNext || false,
      })),
    );
  }

  public setProgressCallback(callback: (progress: string) => void): void {
    this.onProgress = callback;
  }
}

export const STATS_API = new StatsApi();
