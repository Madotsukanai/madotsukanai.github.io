const start = Date.now();
const arr = new Uint8Array(3000000);
let count = 0;
for(let i=0; i<arr.length; i++) {
  const b = arr[i];
  if ((b >= 0x81 && b <= 0x9F) || (b >= 0xE0 && b <= 0xEF)) count++;
}
console.log(Date.now() - start + " ms");
