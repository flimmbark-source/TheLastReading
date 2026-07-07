// Archive content: resonation patterns, unlockable fragments, and attic
// items. Extracted verbatim from the live game (Phase 14).

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
    title:"She Signs It 'S'",
    emoji:'🖋️',
    content:'<p>The paper is thin, almost translucent. The handwriting is careful and very small.</p><p style="font-style:italic">"I have placed the three of them together four times now. The first time was an accident — I didn\'t understand what I had done until it was already done. The second time I was trying to prove something to myself. The third time I knew exactly what I was doing and I did it anyway.</p><p style="font-style:italic">"The fourth time I sat with the cards for a long time before I placed the last one. I am not sure I will do it again."</p><p>At the bottom of the page, in a different ink: <em>S.</em></p>',
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
    content:'<p>Sophia Vael, 44, was found dead at her home at 14 Morrow Lane on March 12, after a neighbor asked police to check on her.</p><p>Ms. Vael had lived alone at the address for eleven years. She was known to see clients privately, though she kept no sign outside the house and did not advertise. Police reported no signs of forced entry and said the death was not being treated as suspicious.</p><p>The neighbor said she became concerned when Ms. Vael\'s curtains remained drawn for several days. She went to the house after dark, when the porch light was out and the moon was bright enough to see by.</p><p>"I was almost spooked away by her wolf statues," she said. "But I knew I needed to check on her so I made myself keep going."</p><p>Ms. Vael had no immediate family in the area. No services are planned.</p>',
  },
  {
    id:'letter_01',
    type:'Correspondence',
    title:'Unsigned Letter',
    emoji:'✉️',
    image:'assets/handwritten_note.webp',
    imageFull:'assets/handwritten_note_full.webp',
    content:'<p>I\'ve been thinking about the woman from the Lorne referral. The one with the practice on Morrow Lane. I\'d been going for a few years by then — long enough that she no longer felt the need to explain herself.</p><p>She worked with three of them set apart from the rest. Not in a row. She was very deliberate about which side each one sat on. The one she placed last, she held for a moment before putting it down. I remember thinking she seemed almost reluctant.</p><p>What I remember most is her hands. She kept both of them moving even when she was still — one always seemed to be giving something, the other receiving. It made me think of someone pouring water carefully, though there was nothing to pour.</p><p>She never explained what she was doing. I think she assumed I would understand.</p>',
  },
  {
    id:'photo_01',
    type:'Photograph',
    title:'The Reading Room',
    emoji:'🖼️',
    image:'assets/Reading_room.webp',
    imageFull:'assets/Reading_Room_Poleroid.webp',
    content:'<p>I found this when we were clearing the house. Nobody knew who to call so it fell to me.</p><p>She isn\'t in the picture — she must have been the one holding the camera. I don\'t recognise anyone at the table. They\'re all looking down at something laid out on the surface, but the photograph is too dark in the center to make it out. On the left edge of the frame you can see part of what looks like a card, face up. There\'s another on the right side. The middle of the table is just black.</p><p>In the background the room looks half-settled — like she\'d only recently moved in. A chair has been placed against the far wall with two tall pillars on either side of it — the left one black, the right one white, each with a capital at the top. A dark curtain is partly drawn across the window behind.</p><p>I keep thinking the center will become clear if I look long enough. It hasn\'t.</p>',
  },
  {
    id:'note_01',
    type:'Sticky Note',
    title:'Note on the Table',
    emoji:'🗒️',
    content:'<p style="font-style:italic">The same 3 again.</p><p style="font-style:italic">Pay attention when their images begin turning up elsewhere.</p>',
  },
]);

export function getArchiveFragment(id) {
  return ARCHIVE_FRAGMENTS[id] || null;
}

export function getArchiveItem(id) {
  return ARCHIVE_ITEMS.find(item => item.id === id) || null;
}
