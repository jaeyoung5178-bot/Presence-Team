/* PptxGenJS 3.12 emits a few non-conforming 2D chart elements.
 * Normalize the package before download; keep native, editable charts/data.
 * Do not silently publish a chart with missing axes or non-finite values.
 */
(function (root) {
  'use strict';
  const C = 'http://schemas.openxmlformats.org/drawingml/2006/chart';
  const A = 'http://schemas.openxmlformats.org/drawingml/2006/main';
  const children = (node, name) => Array.from(node.children || []).filter(n => n.namespaceURI === C && n.localName === name);
  function labelRejectSlices(doc, plot) {
    for (const chart of Array.from(plot.getElementsByTagNameNS(C, 'doughnutChart'))) {
      // MS-OE376 2.1.1475: Office forbids dLblPos within a doughnut series,
      // although the generic OOXML XSD permits it. Omitted position defaults to center.
      for (const position of Array.from(chart.getElementsByTagNameNS(C,'dLblPos'))) position.remove();
      for (const series of children(chart, 'ser')) {
        if (!children(series, 'tx')[0]?.textContent.includes('전체 세일즈의 리젝 구성')) continue;
        const cache = children(series, 'val')[0]?.getElementsByTagNameNS(C, 'numCache')[0];
        const values = children(cache || {}, 'pt').map(pt => Number(children(pt, 'v')[0]?.textContent));
        const total = values.reduce((sum, n) => sum + n, 0);
        // Keep the library's native label structure; edit only formatting/visibility.
        // Labels therefore follow the editable chart and do not become floating text.
        const labels = children(series, 'dLbls')[0];
        if (!labels) throw new Error('Reject chart labels missing');
        for (const label of [labels, ...children(labels, 'dLbl')]) {
          const idx = Number(children(label, 'idx')[0]?.getAttribute('val'));
          const share=values[idx]/total*100;
          const visible = label !== labels && total > 0 && share >= 4;
          for (const name of ['showLegendKey','showVal','showCatName','showSerName','showBubbleSize','showPercent']) {
            children(label, name).forEach(node => node.setAttribute('val', visible && (name === 'showCatName' || (name === 'showPercent' && idx<2)) ? '1' : '0'));
          }
          children(label, 'numFmt').forEach(node => node.setAttribute('formatCode','0.0%'));
          for (const body of Array.from(label.getElementsByTagNameNS(A,'bodyPr'))) body.setAttribute('wrap','none');
          if (label === labels) continue;
          // Space, not Office's default newline, separates category and percentage.
          let separator=children(label,'separator')[0];
          if(!separator){separator=doc.createElementNS(C,'c:separator');label.appendChild(separator);}
          separator.textContent='\u00a0';
          const start=values.slice(0,idx).reduce((sum,n)=>sum+n,0)/total*100;
          let rotation=share<8?(start+share/2)*3.6-90:0;
          while(rotation>90)rotation-=180;
          while(rotation< -90)rotation+=180;
          for(const body of Array.from(label.getElementsByTagNameNS(A,'bodyPr')))body.setAttribute('rot',String(Math.round(rotation*60000)));
          for (const style of Array.from(label.getElementsByTagNameNS(A,'defRPr'))) { style.setAttribute('sz','1200');style.setAttribute('b','1'); }
          for (const color of Array.from(label.getElementsByTagNameNS(A,'srgbClr'))) color.setAttribute('val',idx === 0 ? 'FFFFFF' : idx===1 ? '432700' : '475569');
        }
      }
    }
  }
  function normalizeChart(xml) {
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    if (doc.getElementsByTagName('parsererror').length) throw new Error('Invalid chart XML');
    const plot = doc.getElementsByTagNameNS(C, 'plotArea')[0];
    if (!plot) throw new Error('Chart plot area missing');
    const axes = new Set(Array.from(plot.children).filter(n => /^(cat|val|date|ser)Ax$/.test(n.localName)).map(n => children(n, 'axId')[0]?.getAttribute('val')));
    const ids = new Set();
    for (const series of Array.from(plot.getElementsByTagNameNS(C, 'ser'))) {
      const id = children(series, 'idx')[0]?.getAttribute('val');
      if (id == null || ids.has(id)) throw new Error('Duplicate chart series ID: use fresh data objects for each combo series');
      ids.add(id);
    }
    for (const group of Array.from(plot.children)) {
      if (!['barChart', 'lineChart', 'areaChart'].includes(group.localName)) continue;
      // A 2D chart has category/value axes, not the library's spare 3D series axis.
      for (const axis of children(group, 'axId')) if (!axes.has(axis.getAttribute('val'))) axis.remove();
      if (children(group, 'axId').length !== 2) throw new Error('Unresolved 2D chart axes');
      if (group.localName === 'lineChart' && !children(group, 'grouping').length) {
        const grouping = doc.createElementNS(C, 'c:grouping');
        grouping.setAttribute('val', 'standard');
        group.insertBefore(grouping, group.firstChild);
      }
      for (const series of children(group, 'ser')) {
        if (group.localName !== 'barChart') children(series, 'invertIfNegative').forEach(n => n.remove());
        // PptxGenJS puts the line-series marker after dLbls. OOXML requires it before.
        if (group.localName === 'lineChart') {
          const marker = children(series, 'marker')[0];
          if (marker) {
            const before = Array.from(series.children).find(n => ['dPt', 'dLbls', 'trendline', 'errBars', 'cat', 'val', 'smooth', 'extLst'].includes(n.localName));
            if (before) series.insertBefore(marker, before);
          }
        }
      }
    }
    labelRejectSlices(doc, plot);
    for (const cache of Array.from(doc.getElementsByTagNameNS(C, 'numCache'))) {
      for (const pt of children(cache, 'pt')) {
        const value = children(pt, 'v')[0]?.textContent;
        if (value == null || value.trim() === '' || !Number.isFinite(Number(value))) throw new Error('Invalid numeric chart data');
      }
    }
    for (const color of Array.from(doc.getElementsByTagNameNS(A, 'srgbClr'))) {
      if (!/^[0-9a-f]{6}$/i.test(color.getAttribute('val') || '')) throw new Error('Invalid chart color');
    }
    return new XMLSerializer().serializeToString(doc);
  }
  async function prepare(buffer) {
    if (!root.JSZip) throw new Error('PPT package library unavailable');
    const zip = await root.JSZip.loadAsync(buffer, { checkCRC32: true });
    const parts = Object.keys(zip.files).filter(n => /^ppt\/charts\/chart\d+\.xml$/.test(n));
    if (!parts.length) throw new Error('PPT charts missing');
    for (const part of parts) zip.file(part, normalizeChart(await zip.file(part).async('string')));
    return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', mimeType: 'application/vnd.openxmlformats-officedocument.presentationml.presentation' });
  }
  root.PresenceRecapPptx = { normalizeChart, prepare };
})(window);
