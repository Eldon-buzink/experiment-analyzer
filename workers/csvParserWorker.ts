// workers/csvParserWorker.ts
// @ts-nocheck
import Papa from 'papaparse';

self.onmessage = function (e) {
  try {
    const content = e.data;
    console.log('Worker: Starting to parse content, length:', content ? content.length : 'undefined');
    
    if (!content) {
      self.postMessage({ type: 'error', message: 'No content provided to worker' });
      return;
    }

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
        console.log('Worker: Parsing complete, total rows:', totalRows);
        self.postMessage({ type: 'done', rows: parsedRows, totalRows: totalRows });
      },
      error: function (err) {
        console.error('Worker: Parsing error:', err);
        self.postMessage({ type: 'error', message: err.message || 'Unknown parsing error' });
      }
    });
  } catch (error) {
    console.error('Worker: Unexpected error:', error);
    self.postMessage({ type: 'error', message: error.message || 'Unexpected worker error' });
  }
};
