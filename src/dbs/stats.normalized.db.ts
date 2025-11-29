import Dexie, { Table } from 'dexie';
import { IStatItem, Levels } from '../types/stats.types';
import { DATABASE_NAME } from '../features/stats/stats.const.ts';

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

export class AdStatsNormalizedDatabase extends Dexie {
  suppliers!: Table<ISupplierStatItem>;
  brands!: Table<IBrandStatItem>;
  types!: Table<ITypeStatItem>;
  articles!: Table<IArticleStatItem>;

  constructor() {
    super(`${DATABASE_NAME}_normalized`);

    this.version(1).stores({
      suppliers: '++id, supplier, childCount',
      brands: '++id, parentSupplier, brand, [parentSupplier+brand]',
      types: '++id, parentSupplier, parentBrand, [parentSupplier+parentBrand]',
      articles:
        '++id, parentSupplier, parentBrand, parentType, [parentSupplier+parentBrand+parentType]',
    });
  }
}
