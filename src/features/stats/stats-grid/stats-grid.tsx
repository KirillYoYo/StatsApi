import { useCallback, useEffect, useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import { GridReadyEvent, IServerSideGetRowsParams } from 'ag-grid-community';
import { ModuleRegistry } from 'ag-grid-community';
import {
  ColDef,
  ICellRendererParams,
  ServerSideRowModelModule,
  themeBalham,
} from 'ag-grid-enterprise';
import { IStatItem } from '../../../types/stats.types.ts';
import { useSearchParams } from 'react-router-dom';
import { Metrics } from '../stats.const.ts';
import { statsGridColumnsFactory } from './stats-grid.columns.ts';
import { STATS_API } from '../../../api/stats.api.ts';
import './stats-grid.scss';
import StatsLoader from './statsLoader.tsx';
import { useBootstrapTheme } from '../../../shared/hooks.ts';

ModuleRegistry.registerModules([ServerSideRowModelModule]);

interface IRequestParams {
  level: number;
  parentSupplier?: string;
  parentBrand?: string;
  parentType?: string;
}

export function StatsGrid() {
  const [columnDefs, setColumnDefs] = useState<(ColDef<IStatItem> | ColDef)[]>(
    [],
  );
  const [searchParams] = useSearchParams();
  const metric = searchParams.get('metric') ?? Metrics.cost;
  const [progress, setProgress] = useState<string | null>(null);
  const { isDark, setIsDark } = useBootstrapTheme();

  useEffect(() => {
    STATS_API.setProgressCallback(setProgress);
  }, []);

  useEffect(() => {
    if (!metric) {
      return;
    }
    const dates = Array.from(
      { length: 30 },
      (_, i) =>
        new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
    );
    setColumnDefs(statsGridColumnsFactory(metric, dates));
  }, [metric]);

  const datasource = useMemo(
    () => ({
      getRows: async (params: IServerSideGetRowsParams) => {
        try {
          const requestParams: IRequestParams = {
            level: params.request.groupKeys?.length || 0,
          };

          if (params.request.groupKeys && params.request.groupKeys.length > 0) {
            const level = params.request.groupKeys.length;
            if (level === 1) {
              requestParams.parentSupplier = params.request
                .groupKeys[0] as string;
            } else if (level === 2) {
              requestParams.parentSupplier = params.request
                .groupKeys[0] as string;
              requestParams.parentBrand = params.request.groupKeys[1] as string;
            } else if (level === 3) {
              requestParams.parentSupplier = params.request
                .groupKeys[0] as string;
              requestParams.parentBrand = params.request.groupKeys[1] as string;
              requestParams.parentType = params.request.groupKeys[2] as string;
            }
          }

          const result = await STATS_API.getHierarchyData(requestParams);

          params.success({
            rowData: result,
            rowCount: result.length,
          });
        } catch (error) {
          console.error('Ошибка загрузки данных:', error);
          params.fail();
        }
      },
    }),
    [],
  );

  const onGridReady = useCallback(
    (params: GridReadyEvent) => {
      params.api.setGridOption('serverSideDatasource', datasource);
    },
    [datasource],
  );

  const groupChildCountRenderer = (params: ICellRendererParams) => {
    if (!params.node.group) {
      return params.value;
    }

    const node = params.node;
    const childCount =
      node.allChildrenCount ||
      node.childrenAfterFilter?.length ||
      (params.data?.childCount as number) ||
      0;

    return (
      <span>
        {params.value}
        <span style={{ color: '#666', fontSize: '0.8em', marginLeft: '8px' }}>
          ({childCount})
        </span>
      </span>
    );
  };

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      <div style={{ position: 'absolute', top: -80, right: 4, zIndex: 3 }}>
        <button onClick={() => setIsDark(!isDark)}>
          {isDark ? 'Dark Theme' : 'Light theme'}
        </button>
      </div>
      {progress && progress !== '100.0' && (
        <StatsLoader progress={progress}></StatsLoader>
      )}
      <div className="stats-grid ag-theme-balham">
        <AgGridReact
          defaultColDef={{
            sortable: true,
            filter: true,
            resizable: true,
          }}
          rowModelType="serverSide"
          cacheBlockSize={100}
          maxBlocksInCache={10}
          onGridReady={onGridReady}
          groupHideParentOfSingleChild="leafGroupsOnly"
          autoGroupColumnDef={{
            menuTabs: ['columnsMenuTab'],
            pinned: 'left',
            headerName: 'Article',
            field: 'article',
            cellRenderer: 'agGroupCellRenderer',
            cellRendererParams: {
              suppressCount: false,
              innerRenderer: groupChildCountRenderer,
            },
          }}
          columnDefs={columnDefs}
          theme={themeBalham.withParams({
            backgroundColor: 'var(--bs-body-bg)',
            foregroundColor: 'var(--bs-body-color)',
            browserColorScheme: 'auto',
          })}
        />
      </div>
    </div>
  );
}

export default StatsGrid;
