import { getAuthToken } from "@heyputer/puter.js/src/init.cjs";

const token = await getAuthToken();

console.log("\nYOUR PUTER TOKEN:\n");
console.log(token);