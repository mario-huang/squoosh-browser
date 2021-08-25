import Compress from "./client/lazy-app/Compress";
import fs from "fs";

const buffer = fs.readFileSync("/Users/mario/Documents/Lark20210823-113126.jpg")
let file = new File([buffer], "Lark20210823-113126.jpg")
const compress = new Compress(file);