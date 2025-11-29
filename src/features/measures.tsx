import { useEffect, useRef, useState } from 'react';
import { STATS_API } from '../api/stats.api.ts';
import { STATS_NORMALIZED_API } from '../api/stats.normalized.api.ts';

interface TestResult {
  level: number;
  desc: string;
  denormalized: { time: number; length: number; data: any[] };
  normalized: { time: number; length: number; data: any[] };
}

const Measures = () => {
  const didMountRef = useRef<boolean>(false);
  const [results, setResults] = useState<TestResult[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (didMountRef.current) return;
    didMountRef.current = true;

    const fetchData = async () => {
      setLoading(true);
      const testCases = [
        { level: 0, desc: 'Suppliers (level 0)' },
        {
          level: 1,
          desc: 'Brands (level 1)',
          parentSupplier: 'ООО Обувной барыга',
        },
        {
          level: 2,
          desc: 'Types (level 2)',
          parentSupplier: 'ООО Обувной барыга',
          parentBrand: 'Nike',
        },
        {
          level: 3,
          desc: 'Articles (level 3)',
          parentSupplier: 'ООО Обувной барыга',
          parentBrand: 'Nike',
          parentType: 'Кеды',
        },
      ];

      const testResults: TestResult[] = [];

      console.log('🚀 Testing DENORMALIZED database...');
      for (const testCase of testCases) {
        const t1 = Date.now();
        const result = await STATS_API.getHierarchyData(testCase as any);
        console.log(
          `✅ ${testCase.desc}: ${Date.now() - t1}ms, length: ${result.length}`,
        );
        testResults.push({
          level: testCase.level,
          desc: testCase.desc,
          denormalized: {
            time: Date.now() - t1,
            length: result.length,
            data: result,
          },
          normalized: { time: 0, length: 0, data: [] },
        });
      }

      console.log('\n🚀 Testing NORMALIZED database...');
      for (let i = 0; i < testResults.length; i++) {
        const testCase = testCases[i];
        const t2 = Date.now();
        const result = await STATS_NORMALIZED_API.getHierarchyData(
          testCase as any,
        );
        console.log(
          `✅ ${testCase.desc}: ${Date.now() - t2}ms, length: ${result.length}`,
        );

        testResults[i].normalized = {
          time: Date.now() - t2,
          length: result.length,
          data: result,
        };
      }

      setResults(testResults);
      setLoading(false);
      console.log('\n🎉 All tests completed!');
    };

    fetchData().catch((err) => {
      console.error('❌ Error fetching hierarchy data:', err);
      setLoading(false);
    });
  }, []);

  const formatTime = (ms: number) => `${ms.toFixed(0)}ms`;

  return (
    <div style={{ padding: '20px', fontFamily: 'monospace' }}>
      <h1>🏆 Database Performance Comparison</h1>

      {loading ? (
        <div>⏳ Loading data...</div>
      ) : (
        <>
          <div
            style={{ marginBottom: '20px', fontSize: '14px', color: '#666' }}
          >
            Total tests: {results.length} | Updated:{' '}
            {new Date().toLocaleTimeString()}
          </div>

          <table
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              border: '1px solid #ddd',
              fontSize: '14px',
            }}
          >
            <thead>
              <tr style={{ background: '#f5f5f5' }}>
                <th
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    textAlign: 'left',
                  }}
                >
                  Level
                </th>
                <th
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    textAlign: 'left',
                  }}
                >
                  Description
                </th>
                <th
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    textAlign: 'center',
                  }}
                >
                  Denorm Time
                </th>
                <th
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    textAlign: 'center',
                  }}
                >
                  Denorm Count
                </th>
                <th
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    textAlign: 'center',
                  }}
                >
                  Norm Time
                </th>
                <th
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    textAlign: 'center',
                  }}
                >
                  Norm Count
                </th>
                <th
                  style={{
                    padding: '12px',
                    border: '1px solid #ddd',
                    textAlign: 'center',
                  }}
                >
                  Speedup
                </th>
              </tr>
            </thead>
            <tbody>
              {results.map((result, index) => {
                const speedup =
                  result.denormalized.time / result.normalized.time;
                const isFaster = speedup > 1.5;

                return (
                  <tr
                    key={result.level}
                    style={{
                      background: index % 2 ? '#fafafa' : 'white',
                    }}
                  >
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                      <strong>L{result.level}</strong>
                    </td>
                    <td style={{ padding: '12px', border: '1px solid #ddd' }}>
                      {result.desc}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        border: '1px solid #ddd',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ color: '#d73a49' }}>
                        {formatTime(result.denormalized.time)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        border: '1px solid #ddd',
                        textAlign: 'center',
                      }}
                    >
                      {result.denormalized.length}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        border: '1px solid #ddd',
                        textAlign: 'center',
                      }}
                    >
                      <span style={{ color: '#28a745', fontWeight: 'bold' }}>
                        {formatTime(result.normalized.time)}
                      </span>
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        border: '1px solid #ddd',
                        textAlign: 'center',
                      }}
                    >
                      {result.normalized.length}
                    </td>
                    <td
                      style={{
                        padding: '12px',
                        border: '1px solid #ddd',
                        textAlign: 'center',
                        color: isFaster ? '#28a745' : '#6c757d',
                        fontWeight: isFaster ? 'bold' : 'normal',
                      }}
                    >
                      {isFaster ? `x${speedup.toFixed(1)}` : '–'}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          {/* Детальная информация по клику */}
          <details style={{ marginTop: '20px' }}>
            <summary
              style={{
                cursor: 'pointer',
                padding: '10px',
                background: '#e9ecef',
              }}
            >
              📊 Show Raw Data Samples (click to expand)
            </summary>
            <div style={{ marginTop: '10px', fontSize: '12px' }}>
              {results.map((result) => (
                <details key={result.level} style={{ marginBottom: '10px' }}>
                  <summary style={{ cursor: 'pointer' }}>
                    L{result.level}: {result.desc}
                  </summary>
                  <pre
                    style={{
                      background: '#f8f9fa',
                      padding: '10px',
                      margin: '5px 0',
                      maxHeight: '200px',
                      overflow: 'auto',
                      fontSize: '11px',
                    }}
                  >
                    Denorm:{' '}
                    {JSON.stringify(
                      result.denormalized.data.slice(0, 2),
                      null,
                      2,
                    )}
                    {'\n\n'}
                    Norm:{' '}
                    {JSON.stringify(
                      result.normalized.data.slice(0, 2),
                      null,
                      2,
                    )}
                  </pre>
                </details>
              ))}
            </div>
          </details>
        </>
      )}
    </div>
  );
};

export default Measures;
