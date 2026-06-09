const fs = require('fs');
const file = 'index.html';
let html = fs.readFileSync(file, 'utf8');

const replacements = [
  [
    /newspaper_stack_01:\{[^\n]*?itemTitle:'Strange Obituary',thumb:'strange_obituary\.png'\}/g,
    "newspaper_stack_01:{id:'newspaper_stack_01',label:'Stack of Newspapers',verb:'Move aside',motion:'move',cost:1,before:'props/newspaper_stack_closed.png',after:'props/newspaper_stack_moved.png',left:'25%',top:'73%',width:'22%',height:'17%',itemId:'clipping_01',itemTitle:'Strange Obituary',thumb:'strange_obituary.png'}"
  ],
  [
    /covered_frame_01:\{[^\n]*?itemTitle:'The Reading Room',thumb:'Reading_room\.png'\}/g,
    "covered_frame_01:{id:'covered_frame_01',label:'Covered Frame',verb:'Lift cloth',motion:'lift',cost:1,before:'props/covered_frame_closed.png',after:'props/covered_frame_uncovered.png',left:'68%',top:'15%',width:'25%',height:'42%',itemId:'photo_01',itemTitle:'The Reading Room',thumb:'Reading_room.png'}"
  ],
  [
    /coat_01:\{[^\n]*?itemTitle:'Unsigned Letter',thumb:'handwritten_note\.png'\}/g,
    "coat_01:{id:'coat_01',label:'Old Coat',verb:'Check pocket',motion:'search',cost:1,before:'props/old_coat_closed.png',after:'props/old_coat_searched.png',left:'2%',top:'13%',width:'18%',height:'54%',itemId:'letter_01',itemTitle:'Unsigned Letter',thumb:'handwritten_note.png'}"
  ]
];

for (const [pattern, replacement] of replacements) {
  html = html.replace(pattern, replacement);
}

fs.writeFileSync(file, html);
console.log('Applied attic prop state fix.');
