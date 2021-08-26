import _ from 'lodash';
import Compress from '@yireen/squoosh-browser'

function component() {
    const element = document.createElement('div');
  
    // Lodash, now imported by this script
    element.innerHTML = _.join(['Hello', 'webpack'], ' ');

    const compress = new Compress();
    const compressFile = compress.process();
  
    return element;
  }
  
  document.body.appendChild(component());