const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '// Archives close patch';

// Keep the original tab name. Older attic patches briefly renamed it.
html = html.replace(/Attic Drawer/g, 'Archives');
html = html.replace(/Attic drawer/g, 'Archives');
html = html.replace(/attic drawer/g, 'archives');

if (!html.includes(marker)) {
  const js = `
${marker}
(function(){
  function closeArchives(){
    try{ if(typeof invOpen !== 'undefined') invOpen = false; }catch(e){}
    const wrap = document.getElementById('invWrap');
    if(wrap) wrap.classList.remove('open');
    const tab = document.getElementById('invTab');
    if(tab) tab.innerHTML = '&#9660; Archives';
    document.querySelectorAll('.inv-detail,.invDetail,#invDetail').forEach(function(el){ el.remove(); });
  }
  window.tlrCloseArchives = closeArchives;

  if(typeof startReading === 'function' && !startReading.__tlrArchivesCloseWrapped){
    const originalStartReading = startReading;
    startReading = function(){
      closeArchives();
      return originalStartReading.apply(this, arguments);
    };
    startReading.__tlrArchivesCloseWrapped = true;
  }

  function wrapWindowFunction(name){
    const fn = window[name];
    if(typeof fn !== 'function' || fn.__tlrArchivesCloseWrapped) return;
    const wrapped = function(){
      closeArchives();
      return fn.apply(this, arguments);
    };
    wrapped.__tlrArchivesCloseWrapped = true;
    window[name] = wrapped;
  }

  wrapWindowFunction('tlrDebugEnterAttic');
  wrapWindowFunction('tlrEnterAtticAfterReading');
  wrapWindowFunction('tlrDebugLeaveAttic');
})();
`;
  html = html.replace('</script>', js + '\n</script>');
}

fs.writeFileSync(file, html);
console.log('Applied Archives close patch.');
