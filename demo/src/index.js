import Compress from '@yireen/squoosh-browser'

const file = document.getElementById('file');
file.onchange = async (event) => {
  const image = event.target.files[0];
  console.log('start');
  console.log('time', new Date());
  console.log('size', image.size);
  const compress = new Compress(image);
  const compressFile = await compress.process();
  console.log('end');
  console.log('time', new Date());
  console.log('size', compressFile.size);
  const reader = new FileReader()
  reader.onload = () => {
    const img = new Image()
    img.src = reader.result
    img.style = 'width:30%;'
    document.body.appendChild(img)  // reader.result为获取结果
  }
  reader.readAsDataURL(compressFile)


}
