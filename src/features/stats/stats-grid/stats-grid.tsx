import { AgGridReact } from 'ag-grid-react';
import { useEffect, useRef, useState } from 'react';
import { IStatItem } from '../../../types/stats.types';
import { STATS_API } from '../../../api/stats.api';
import { ColDef, themeBalham } from 'ag-grid-enterprise';
import { useSearchParams } from 'react-router-dom';
import { Metrics } from '../stats.const';
import { statsGridColumnsFactory } from './stats-grid.columns';
import './stats-grid.scss';

export function StatsGrid() {
  const [rowData, setRowData] = useState<IStatItem[] | null>(null);
  const [columnDefs, setColumnDefs] = useState<ColDef<IStatItem>[]>([]);
  const [searchParams] = useSearchParams();
  const metric = searchParams.get('metric') ?? Metrics.cost;
  const didMountRef = useRef<boolean>(false);
  const [progress, setProgress] = useState<string | null>(null);

  useEffect(() => {
    const dates = Array.from(
      { length: 30 },
      (_, i) =>
        new Date(Date.now() - i * 24 * 60 * 60 * 1000)
          .toISOString()
          .split('T')[0],
    );
    setColumnDefs(statsGridColumnsFactory(metric, dates));
  }, [metric]);

  useEffect(() => {
    if (didMountRef.current) return; // для дев разработки, чтобы 2 раза не срабатывало
    didMountRef.current = true;

    STATS_API.setProgressCallback(setProgress);

    let t_1 = Date.now();
    STATS_API.getHierarchyData({ level: 0 }).then((data) => {
      setRowData(data);
      console.log('get level 0 at:', `${Date.now() - t_1}ms`);
    });
  }, []);

  return (
    <div style={{ position: 'relative', height: '100%', width: '100%' }}>
      {progress && progress !== '100.0' && (
        <div
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            width: '100%',
            height: '100%',
            background: 'rgba(0,0,0, 0.1)',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            zIndex: 5,
          }}
        >
          <span
            style={{
              padding: 20,
              color: '#fff',
              backgroundColor: 'rgba(0,0,0, 0.5)',
            }}
          >
            Loading database {progress}%
          </span>
        </div>
      )}
      <div className="stats-grid ag-theme-balham">
        <AgGridReact
          groupHideParentOfSingleChild="leafGroupsOnly"
          autoGroupColumnDef={{
            menuTabs: ['columnsMenuTab'],
            pinned: 'left',
            headerName: 'Article',
            field: 'article',
          }}
          theme={themeBalham.withParams({
            backgroundColor: 'var(--bs-body-bg)',
            foregroundColor: 'var(--bs-body-color)',
            browserColorScheme: 'light',
          })}
          rowData={rowData}
          columnDefs={columnDefs}
        ></AgGridReact>
      </div>
    </div>
  );
}
