const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const marker = '// Attic drawer close patch';

if (!html.includes(marker)) {
  const js = `
${marker}
(function(){
  function closeAtticDrawer(){
    try{ if(typeof invOpen !== 'undefined') invOpen = false; }catch(e){}
    const wrap = document.getElementById('invWrap');
    if(wrap) wrap.classList.remove('open');
    const tab = document.getElementById('invTab');
    if(tab) tab.innerHTML = '&#9660; Attic Drawer';
    document.querySelectorAll('.inv-detail,.invDetail,#invDetail').forEach(function(el){ el.remove(); });
  }
  window.tlrCloseAtticDrawer = closeAtticDrawer;

  if(typeof startReading === 'function' && !startReading.__tlrDrawerCloseWrapped){
    const originalStartReading = startReading;
    startReading = function(){
      closeAtticDrawer();
      return originalStartReading.apply(this, arguments);
    };
    startReading.__tlrDrawerCloseWrapped = true;
  }

  function wrapWindowFunction(name){
    const fn = window[name];
    if(typeof fn !== 'function' || fn.__tlrDrawerCloseWrapped) return;
    const wrapped = function(){
      closeAtticDrawer();
      return fn.apply(this, arguments);
    };
    wrapped.__tlrDrawerCloseWrapped = true;
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
console.log('Applied attic drawer close patch.');
