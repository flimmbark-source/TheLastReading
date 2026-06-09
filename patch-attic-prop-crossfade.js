const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

// Fix 1: Remove blue tap-highlight on press
const oldPropCss = '.attic-prop{position:absolute;background-size:contain;background-repeat:no-repeat;background-position:center;touch-action:manipulation;user-select:none;cursor:pointer;filter:drop-shadow(0 16px 22px rgba(0,0,0,.58));transition:transform .18s ease,filter .18s ease,opacity .18s ease}';
const newPropCss = '.attic-prop{position:absolute;background-size:contain;background-repeat:no-repeat;background-position:center;touch-action:manipulation;user-select:none;cursor:pointer;-webkit-tap-highlight-color:transparent;outline:none;filter:drop-shadow(0 16px 22px rgba(0,0,0,.58));transition:transform .18s ease,filter .18s ease,opacity .18s ease}';

if (html.includes(oldPropCss)) {
  html = html.replace(oldPropCss, newPropCss);
  console.log('Fixed: tap-highlight-color on .attic-prop');
} else {
  console.warn('WARN: could not find .attic-prop CSS to patch tap-highlight');
}

// Fix 2: Add crossfade image layer CSS (insert after the .attic-prop.searched::after rule)
const afterSearchedRule = '.attic-prop.searched::after{display:none}';
const crossfadeCss = `${afterSearchedRule}
.prop-img{position:absolute;inset:0;background-size:contain;background-repeat:no-repeat;background-position:center;transition:opacity .38s ease;pointer-events:none}
.prop-img-after{opacity:0}
.attic-prop.searched .prop-img-before{opacity:0}
.attic-prop.searched .prop-img-after{opacity:1}`;

if (html.includes(afterSearchedRule) && !html.includes('.prop-img-after{opacity:0}')) {
  html = html.replace(afterSearchedRule, crossfadeCss);
  console.log('Fixed: added crossfade CSS layers');
} else if (html.includes('.prop-img-after{opacity:0}')) {
  console.log('Crossfade CSS already present, skipping');
} else {
  console.warn('WARN: could not find .attic-prop.searched::after rule to insert crossfade CSS');
}

// Fix 3: Replace renderObjects to use layered child divs with crossfade, not innerHTML wipe
const oldRenderObjects = `function renderObjects(){
    const root=document.getElementById('atticObjects');if(!root)return;root.innerHTML='';
    Object.keys(objects).forEach(function(k){const o=objects[k];const alreadyFound=foundItems().includes(o.itemId);const done=!!searched[o.id]||alreadyFound;const el=document.createElement('div');el.className='attic-prop motion-'+o.motion+(done?' searched':'');el.style.left=o.left;el.style.top=o.top;el.style.width=o.width;el.style.height=o.height;el.style.backgroundImage='url("'+(done?o.after:o.before)+'")';el.style.backgroundSize='contain';el.style.backgroundPosition='center';el.style.backgroundRepeat='no-repeat';el.setAttribute('role','button');el.setAttribute('aria-label',done?(o.label+' already searched'):(o.verb+' '+o.label));if(!done)el.addEventListener('click',function(e){e.stopPropagation();rummage(o.id,el);});else el.style.pointerEvents='none';root.appendChild(el);});
  }`;

const newRenderObjects = `function renderObjects(){
    const root=document.getElementById('atticObjects');if(!root)return;
    Object.keys(objects).forEach(function(k){
      const o=objects[k];const alreadyFound=foundItems().includes(o.itemId);const done=!!searched[o.id]||alreadyFound;
      let el=root.querySelector('[data-prop-id="'+o.id+'"]');
      if(!el){
        el=document.createElement('div');
        el.className='attic-prop motion-'+o.motion;
        el.dataset.propId=o.id;
        el.style.left=o.left;el.style.top=o.top;el.style.width=o.width;el.style.height=o.height;
        const bef=document.createElement('div');bef.className='prop-img prop-img-before';bef.style.backgroundImage='url("'+o.before+'")';
        const aft=document.createElement('div');aft.className='prop-img prop-img-after';aft.style.backgroundImage='url("'+o.after+'")';
        el.appendChild(bef);el.appendChild(aft);
        el.setAttribute('role','button');el.setAttribute('aria-label',o.verb+' '+o.label);
        if(!done)el.addEventListener('click',function(e){e.stopPropagation();rummage(o.id,el);});
        root.appendChild(el);
      }
      if(done&&!el.classList.contains('searched')){
        el.classList.add('searched');
        el.setAttribute('aria-label',o.label+' already searched');
        el.style.pointerEvents='none';
      }
    });
  }`;

if (html.includes(oldRenderObjects)) {
  html = html.replace(oldRenderObjects, newRenderObjects);
  console.log('Fixed: renderObjects now uses crossfade image layers');
} else {
  console.warn('WARN: could not find renderObjects to replace — may need manual check');
}

fs.writeFileSync(file, html);
console.log('Applied attic prop crossfade patch.');
