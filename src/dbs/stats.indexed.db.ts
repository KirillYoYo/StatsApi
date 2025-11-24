import Dexie, { Table } from 'dexie';
import { IStatItem, Levels } from '../types/stats.types';
import { DATABASE_NAME } from '../features/stats/stats.const.ts';

export interface IHierarchyStatItem extends IStatItem {
  id?: number;
  level: Levels;
  parentSupplier?: string;
  parentBrand?: string;
  parentType?: string;
  totalCost?: number;
  totalOrders?: number;
  totalReturns?: number;
  avgCost?: number;
  childCount: number;
}

export class AdStatsDatabase extends Dexie {
  stats!: Table<IHierarchyStatItem>;

  constructor() {
    super(DATABASE_NAME);

    this.version(1).stores({
      stats: `
                ++id,
                level, article, type, brand, supplier,
                parentSupplier, parentBrand, parentType,
                totalCost, totalOrders, totalReturns, avgCost,
                [level],
                [level+parentSupplier],
                [level+parentSupplier+parentBrand], 
                [level+parentSupplier+parentBrand+parentType],
                [supplier+brand+type+article],
                *cost, *orders, *returns,
                lastUpdate
            `,
    });

    this.open().catch((err) => {
      console.error('❌ Ошибка открытия базы:', err);
    });
  }
}
