// workers/csvParserWorker.ts
// @ts-nocheck

// Inline PapaParse for worker compatibility
const Papa = {
  parse: function(content, config) {
    const lines = content.split('\n');
    const headers = lines[0].split(',').map(h => h.trim().replace(/"/g, ''));
    const data = [];
    
    for (let i = 1; i < lines.length; i++) {
      if (lines[i].trim() === '') continue;
      
      const values = lines[i].split(',').map(v => v.trim().replace(/"/g, ''));
      const row = {};
      
      for (let j = 0; j < headers.length; j++) {
        row[headers[j]] = values[j] || '';
      }
      
      data.push(row);
      
      if (config.step) {
        config.step({ data: row }, { data: data });
      }
    }
    
    if (config.complete) {
      config.complete({ data: data });
    }
  }
};

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
