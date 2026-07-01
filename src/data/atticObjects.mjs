// Attic prop definitions. Extracted verbatim from the live game (Phase 14).

export const ATTIC_OBJECTS = Object.freeze({
  newspaper_stack_01:{id:'newspaper_stack_01',label:'Stack of Newspapers',verb:'Move aside',motion:'move',cost:1,before:'props/newspaper_stack_closed.png',after:'props/newspaper_stack_moved.png',left:'25%',top:'73%',width:'22%',height:'17%',itemId:'clipping_01',itemTitle:'Strange Obituary',thumb:'assets/strange_obituary.webp'},
  covered_frame_01:{id:'covered_frame_01',label:'Covered Frame',verb:'Lift cloth',motion:'lift',cost:1,before:'props/covered_frame_closed.png',after:'props/covered_frame_uncovered.png',left:'68%',top:'15%',width:'25%',height:'42%',itemId:'photo_01',itemTitle:'The Reading Room',thumb:'assets/Reading_room.webp'},
  coat_01:{id:'coat_01',label:'Old Coat',verb:'Check pocket',motion:'search',cost:1,before:'props/old_coat_closed.png',after:'props/old_coat_searched.png',left:'2%',top:'13%',width:'18%',height:'54%',itemId:'letter_01',itemTitle:'Unsigned Letter',thumb:'assets/handwritten_note.webp'}
  });

// Score-to-obal ladder used when a session ends and the attic opens.
export const OBAL_SCORE_LADDER = Object.freeze([
  [1000, 7],
  [700, 6],
  [450, 5],
  [250, 4],
  [100, 3],
  [50, 2],
]);

export const MIN_OBALS = 1;
