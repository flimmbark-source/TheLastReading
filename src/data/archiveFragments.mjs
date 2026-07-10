// Archive content: resonation patterns, unlockable fragments, and attic
// items. Extracted verbatim from the live game (Phase 14).
//
// Archive prose is in-world source material or diegetic analysis. It defaults
// to gameTerms:'off' so mechanical token styling never reveals puzzle links or
// turns ordinary words such as "between" into Ability callouts.

export const RESONATIONS = Object.freeze([
  {
    id:'sophias_fall',
    name:"Sophia's Fall",
    conditions:[
      {cardId:'major_2',  itemId:'photo_01'},                              // II High Priestess — The Reading Room
      {cardId:'major_17', itemId:'letter_01', anyOf:['major_17','major_14']}, // XVII The Star or XIV Temperance — Unsigned Letter
      {cardId:'major_18', itemId:'clipping_01'},                           // XVIII The Moon — Strange Obituary
    ],
    fragmentId:'frag_sophias_fall_1',
    chips:25,
    mult:1,
  },
]);

export const ARCHIVE_FRAGMENTS = Object.freeze({
  frag_sophias_fall_1:{
    id:'frag_sophias_fall_1',
    type:'Handwritten Note',
    title:"Scribbed Note",
    emoji:'🖋️',
    contentKind:'source',
    gameTerms:'off',
    content:'<p>I know how probability works. I had read for many, many people. When the mind is desperate, it tries to see a pattern in everything, this is not that.</p><p>I have accounted for all of it. I bought new decks. I let strangers cut them. I even casted blind. But it is always the same three.</p><p>It has to be her, it has to be. Finally, she reaches out to me.</p>',
  },
});

export const ARCHIVE_ITEMS = Object.freeze([
  {
    id:'clipping_01',
    type:'Newspaper Clipping',
    title:'Strange Obituary',
    emoji:'📰',
    image:'assets/strange_obituary.webp',
    imageFull:'assets/Obituary_Newspaper.webp',
    contentKind:'source',
    gameTerms:'off',
    content:'<p>Sophia Vael, 44, was found dead at her home at 14 Morrow Lane on March 12, after a neighbor requested a welfare check.</p><p>Ms. Vael had lived alone at the address for eleven years, receiving clients privately. Police reported no signs of forced entry; the death is not considered suspicious.</p><p>The neighbor became concerned when Ms. Vael\'s curtains remained drawn for days, and went to check on her after dark.</p><p>"I almost turned back because of those stone wolf statues by her door," she said. "They looked too real in the light of the full moon. But I had a bad feeling, so I kept going."</p><p>Ms. Vael leaves behind no local family. No services are planned.</p>',
  },
  {
    id:'letter_01',
    type:'Correspondence',
    title:'Unsigned Letter',
    emoji:'✉️',
    image:'assets/handwritten_note.webp',
    imageFull:'assets/handwritten_note_full.webp',
    contentKind:'source',
    gameTerms:'off',
    content:'<p>I can\'t shake the thought of the woman on Morrow Lane. I\'ve been going to her for years, and when I arrive now she already has three of them laid out, as if she\'d just been preforming her own reading. She seems so reluctant to look up from the cards.</p><p>When she does my reading now, she\'s always moving her hands, like she\'s pouring water from one invisible glass to another, trying not to spill a drop. It\'s mesmerizing.</p><p>She never explained what she was doing. I think she assumed I already knew.</p>',
  },
  {
    id:'photo_01',
    type:'Photograph',
    title:'The Reading Room',
    emoji:'🖼️',
    image:'assets/Reading_room.webp',
    imageFull:'assets/Reading_Room_Poleroid.webp',
    contentKind:'analysis',
    gameTerms:'off',
    content:'<p>Nobody else wants to touch her things, so it falls to me.</p><p>She isn\'t in the shot; she must have been holding the camera. I don\'t recognize the people at the table. They\'re all leaning in, staring down at something, but the center of the photo is too dark and muddy to make out.</p><p>The room behind them is half-settled, looks like she\'s still moving in. A high-backed chair sits against the far wall between two tall pillars—the left one matte black, the right one white. A dark curtain is drawn halfway across the window.</p>',
  },
  {
    id:'note_01',
    type:'Sticky Note',
    title:'Note on the Table',
    emoji:'🗒️',
    hideDetailHeader:true,
    contentKind:'source',
    gameTerms:'off',
    content:'<p style="font-style:italic">It\'s the same three every single time I try. I shuffle them, but they just find their way back. I\'m not crazy.</p>',
  },
]);

export function getArchiveFragment(id) {
  return ARCHIVE_FRAGMENTS[id] || null;
}

export function getArchiveItem(id) {
  return ARCHIVE_ITEMS.find(item => item.id === id) || null;
}
