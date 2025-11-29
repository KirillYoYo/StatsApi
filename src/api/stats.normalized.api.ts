import { IStatItem, IStatItemRaw, Levels } from '../types/stats.types';
import { AdStatsNormalizedDatabase } from '../dbs/stats.normalized.db.ts';
import { checkDatabaseExists } from '../utils.ts';
import { Observable, fromEventPattern } from 'rxjs';
import { filter, map } from 'rxjs/operators';
import { DATABASE_NAME } from '../features/stats/stats.const.ts';
import { STATS_API } from './stats.api.ts';

export interface ISupplierStatItem extends IStatItem {
  id?: number;
  level: Levels.supplier;
  totalCost?: number;
  totalOrders?: number;
  totalReturns?: number;
  avgCost?: number;
  childCount: number;
}

export interface IBrandStatItem extends IStatItem {
  id?: number;
  level: Levels.brand;
  parentSupplier: string;
  totalCost?: number;
  totalOrders?: number;
  totalReturns?: number;
  avgCost?: number;
  childCount: number;
}

export interface ITypeStatItem extends IStatItem {
  id?: number;
  level: Levels.type;
  parentSupplier: string;
  parentBrand: string;
  totalCost?: number;
  totalOrders?: number;
  totalReturns?: number;
  avgCost?: number;
  childCount: number;
}

export interface IArticleStatItem extends IStatItem {
  id?: number;
  level: Levels.article;
  parentSupplier: string;
  parentBrand: string;
  parentType: string;
  totalCost?: number;
  totalOrders?: number;
  totalReturns?: number;
  avgCost?: number;
  childCount: number;
}

interface WorkerMessage {
  action: string;
  requestId: string;
  size?: number;
  result?: IStatItem[];
  payload?: IStatItem[];
  isNext?: boolean;
}

class NormalizedStatsApi {
  private getRequestId(): string {
    return Math.random().toString(36).substring(2, 15);
  }

  private worker: Worker;
  private resolvedMessages = new Map<string, IStatItem[]>();
  private db: AdStatsNormalizedDatabase | null = null;
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

  public async initializeDatabase(): Promise<void> {
    if (!this.db) {
      this.db = new AdStatsNormalizedDatabase();
    }

    this.onProgress?.(`getting data...`);
    const rawData = STATS_API.rawData;

    console.log(`📥 Загружено raw данных: ${rawData.length}`);

    const articles: IArticleStatItem[] = rawData
      .map((item) => ({
        level: Levels.article,
        supplier: item.supplier,
        brand: item.brand,
        type: item.type,
        article: `ART_${item.article}`,
        parentSupplier: item.supplier,
        parentBrand: item.brand,
        parentType: item.type,
        childCount: 0,
        cost: item.cost || new Array(30).fill(0),
        orders: item.orders || new Array(30).fill(0),
        returns: item.returns || new Array(30).fill(0),
        lastUpdate: new Date().toISOString(),
      }))
      .map((item) => this.calculateDerivedMetrics(item));

    const typesMap = new Map<string, ITypeStatItem>();
    const brandsMap = new Map<string, IBrandStatItem>();
    const suppliersMap = new Map<string, ISupplierStatItem>();

    for (const article of articles) {
      const typeKey = `${article.parentSupplier}|${article.parentBrand}|${article.parentType}`;
      if (!typesMap.has(typeKey)) {
        typesMap.set(typeKey, {
          level: Levels.type,
          supplier: article.parentSupplier!,
          brand: article.parentBrand!,
          type: article.parentType!,
          article: '',
          parentSupplier: article.parentSupplier!,
          parentBrand: article.parentBrand!,
          childCount: 0,
          cost: new Array(30).fill(0),
          orders: new Array(30).fill(0),
          returns: new Array(30).fill(0),
          lastUpdate: new Date().toISOString(),
        });
      }
      const typeItem = typesMap.get(typeKey)!;
      this.aggregateItemData(typeItem, article);
      typeItem.childCount += 1;

      const brandKey = `${article.parentSupplier}|${article.parentBrand}`;
      if (!brandsMap.has(brandKey)) {
        brandsMap.set(brandKey, {
          level: Levels.brand,
          supplier: article.parentSupplier!,
          brand: article.parentBrand!,
          parentSupplier: article.parentSupplier!,
          childCount: 0,
          cost: new Array(30).fill(0),
          orders: new Array(30).fill(0),
          returns: new Array(30).fill(0),
          lastUpdate: new Date().toISOString(),
        });
      }
      const brandItem = brandsMap.get(brandKey)!;
      this.aggregateItemData(brandItem, article);
      brandItem.childCount += 1;

      if (!suppliersMap.has(article.parentSupplier!)) {
        suppliersMap.set(article.parentSupplier!, {
          level: Levels.supplier,
          supplier: article.parentSupplier!,
          childCount: 0,
          cost: new Array(30).fill(0),
          orders: new Array(30).fill(0),
          returns: new Array(30).fill(0),
          lastUpdate: new Date().toISOString(),
        });
      }
      const supplierItem = suppliersMap.get(article.parentSupplier!)!;
      this.aggregateItemData(supplierItem, article);
      supplierItem.childCount += 1;
    }

    const types = Array.from(typesMap.values()).map((item) =>
      this.calculateDerivedMetrics(item),
    );
    const brands = Array.from(brandsMap.values()).map((item) =>
      this.calculateDerivedMetrics(item),
    );
    const suppliers = Array.from(suppliersMap.values()).map((item) =>
      this.calculateDerivedMetrics(item),
    );

    console.log(
      `📊 FINISHED: suppliers=${suppliers.length}, brands=${brands.length}, types=${types.length}, articles=${articles.length}`,
    );

    await Promise.all([
      this.db!.suppliers.clear(),
      this.db!.brands.clear(),
      this.db!.types.clear(),
      this.db!.articles.clear(),
    ]);

    await this.safeBulkAddWithProgress({ articles, types, brands, suppliers });
  }

  public async getHierarchyData(params: {
    level: number;
    parentSupplier?: string;
    parentBrand?: string;
    parentType?: string;
  }): Promise<any[]> {
    const normalizedDbName = `${DATABASE_NAME}_normalized`;
    const isBaseExist = await checkDatabaseExists(normalizedDbName);
    if (!this.db) {
      console.log('🔄 Инициализация Normalized DB...');
      this.db = new AdStatsNormalizedDatabase();
      if (!isBaseExist) {
        await this.initializeDatabase();
      }
    }

    switch (params.level) {
      case 0:
        return await this.db!.suppliers.toArray();
      case 1:
        if (!params.parentSupplier) throw new Error('parentSupplier required');
        return await this.db!.brands.where('parentSupplier')
          .equals(params.parentSupplier)
          .toArray();
      case 2:
        if (!params.parentSupplier || !params.parentBrand)
          throw new Error('parentSupplier и parentBrand required');
        return await this.db!.types.where('[parentSupplier+parentBrand]')
          .between(
            [params.parentSupplier, params.parentBrand],
            [params.parentSupplier, params.parentBrand + '\uffff'],
          )
          .toArray();

      case 3:
        if (!params.parentSupplier || !params.parentBrand || !params.parentType)
          throw new Error('Все родители required');
        return await this.db!.articles.where(
          '[parentSupplier+parentBrand+parentType]',
        )
          .between(
            [params.parentSupplier, params.parentBrand, params.parentType],
            [
              params.parentSupplier,
              params.parentBrand,
              params.parentType + '\uffff',
            ],
          )
          .toArray();

      default:
        return [];
    }
  }

  private async safeBulkAddWithProgress(
    data: {
      articles: IArticleStatItem[];
      types: ITypeStatItem[];
      brands: IBrandStatItem[];
      suppliers: ISupplierStatItem[];
    },
    chunkSize = 8000,
  ): Promise<{ successfulAdds: number; failedAdds: number } | void> {
    if (!this.db) return;

    const allItems = [
      ...data.suppliers,
      ...data.brands,
      ...data.types,
      ...data.articles,
    ];

    this.onProgress?.(`${0}`);
    let successfulAdds = 0;
    let failedAdds = 0;

    for (let i = 0; i < allItems.length; i += chunkSize) {
      const chunk = allItems.slice(i, i + chunkSize);
      const tableMap: Record<Levels, keyof AdStatsNormalizedDatabase> = {
        [Levels.supplier]: 'suppliers',
        [Levels.brand]: 'brands',
        [Levels.type]: 'types',
        [Levels.article]: 'articles',
      };

      try {
        const tableChunks: Record<string, any[]> = {};
        for (const item of chunk) {
          const tableName = tableMap[item.level as Levels];
          if (!tableChunks[tableName]) tableChunks[tableName] = [];
          tableChunks[tableName].push(item);
        }

        for (const [tableName, tableChunk] of Object.entries(tableChunks)) {
          // @ts-ignore
          await this.db![tableName].bulkAdd(tableChunk);
          successfulAdds += tableChunk.length;
        }
      } catch (error: any) {
        if (error.name === 'ConstraintError') {
          for (const item of chunk) {
            try {
              const tableName = tableMap[item.level as Levels];
              // @ts-ignore
              await this.db![tableName].add(item);
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

      const progress = (((i + chunk.length) / allItems.length) * 100).toFixed(
        1,
      );
      this.onProgress?.(progress);
      console.log(
        `Progress: ${progress}% | Success: ${successfulAdds} | Failed: ${failedAdds}`,
      );

      await new Promise((resolve) => requestAnimationFrame(resolve));
    }

    return { successfulAdds, failedAdds };
  }

  private aggregateItemData(target: any, source: any): void {
    for (let i = 0; i < 30; i++) {
      target.cost![i] = (target.cost![i] || 0) + (source.cost[i] || 0);
      target.orders![i] = (target.orders![i] || 0) + (source.orders[i] || 0);
      target.returns![i] = (target.returns![i] || 0) + (source.returns[i] || 0);
    }
  }

  private calculateDerivedMetrics(item: any): any {
    const cost = item.cost || [];
    const orders = item.orders || [];
    const returns = item.returns || [];

    item.revenue = cost.map((c: number, i: number) => {
      const buyouts = (orders[i] || 0) - (returns[i] || 0);
      return c * buyouts;
    });

    item.buyouts = orders.map((o: number, i: number) => o - (returns[i] || 0));

    item.totalCost = cost.reduce((sum: number, val: number) => sum + val, 0);
    item.totalOrders = orders.reduce(
      (sum: number, val: number) => sum + val,
      0,
    );
    item.totalReturns = returns.reduce(
      (sum: number, val: number) => sum + val,
      0,
    );
    item.totalRevenue = item.revenue!.reduce(
      (sum: number, val: number) => sum + val,
      0,
    );
    item.totalBuyouts = item.buyouts!.reduce(
      (sum: number, val: number) => sum + val,
      0,
    );
    item.avgCost = item.totalCost ? item.totalCost / item.totalOrders : 0;

    item.lastUpdate = new Date().toISOString();
    return item;
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
      filter((event) => event.data.action === 'getStatsStream'),
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

export const STATS_NORMALIZED_API = new NormalizedStatsApi();
