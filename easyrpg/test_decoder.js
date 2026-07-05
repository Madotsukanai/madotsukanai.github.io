const start = Date.now();
const arr = new Uint8Array(3000000);
for(let i=0; i<arr.length; i++) arr[i] = Math.floor(Math.random()*256);
const decoder = new TextDecoder('sjis', { fatal: false });
const str = decoder.decode(arr);
console.log(Date.now() - start + " ms, length: " + str.length);
