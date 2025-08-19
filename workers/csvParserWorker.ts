// workers/csvParserWorker.ts
// @ts-nocheck
import Papa from 'papaparse';

self.onmessage = function (e) {
  const content = e.data;
  let parsedRows = [];
  let totalRows = 0;

  Papa.parse(content, {
    header: true,
    skipEmptyLines: true,
    step: function (results, parser) {
      parsedRows.push(results.data);
      totalRows++;
      if (totalRows % 1000 === 0) {
        self.postMessage({ type: 'progress', value: totalRows });
      }
    },
    complete: function () {
      self.postMessage({ type: 'done', rows: parsedRows });
    },
    error: function (err) {
      self.postMessage({ type: 'error', message: err.message });
    }
  });
};
