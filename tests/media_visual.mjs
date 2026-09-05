import test from 'node:test';
import assert from 'node:assert/strict';
import {mediaVisualDescriptor, referenceCaption} from '../web/media_visual.js';
test('Composer consumes staged visual representations without inventing reference identity',()=>{
  const asset={type:'video',status:'needs_edit',reference:null,contact_sheet_url:'sheet',contact_sheet_width:800,contact_sheet_height:600};
  assert.equal(mediaVisualDescriptor(asset).src,'sheet');
  assert.equal(referenceCaption(asset),'');
  assert.equal(referenceCaption({...asset,reference:'<Video 2>'}),'<Video 2>');
  assert.equal(mediaVisualDescriptor({...asset,contact_sheet_url:null}),null);
});
