import { test } from "node:test";
import assert from "node:assert/strict";
import { findFunctions, supportsFunctions } from "../src/analysis/functions.js";

const names = (path: string, src: string) => findFunctions(path, src.split("\n")).map((f) => f.name);

test("JavaScript / TypeScript definitions", () => {
  const src = [
    "export async function loadConfig(path) {",
    "const add = (a, b) => a + b;",
    "export const fetcher = async (url: string): Promise<void> => {",
    "class Router {",
    "  constructor(opts) {",
    "  async handle(req, res) {",
    "  if (x) {",
    "// function commented(a) {",
    "/* function blocked() {",
    "   still comment */",
  ].join("\n");
  assert.deepEqual(names("a.ts", src), ["loadConfig", "add", "fetcher", "Router", "constructor", "handle"]);
});

test("Python definitions", () => {
  assert.deepEqual(names("a.py", "class Model:\n    def __init__(self):\n    async def save(self):\n# def nope():"), ["Model", "__init__", "save"]);
});

test("Go, Rust and Ruby definitions", () => {
  assert.deepEqual(names("a.go", "func main() {\nfunc (s *Server) Serve(l net.Listener) error {"), ["main", "Serve"]);
  assert.deepEqual(names("a.rs", "pub fn parse(input: &str) -> Ast {\npub(crate) async fn run() {\nstruct Point {"), ["parse", "run", "Point"]);
  assert.deepEqual(names("a.rb", "class User\n  def self.find(id)\n  def valid?"), ["User", "find", "valid?"]);
});

test("Java / C-like definitions skip control flow", () => {
  const src = "public class App {\n  public static void main(String[] args) {\n    if (args.length > 0) {\n    return compute(x);\n  private int compute(int x) {";
  assert.deepEqual(names("App.java", src), ["App", "main", "compute"]);
});

test("unsupported files yield nothing", () => {
  assert.ok(!supportsFunctions("README.md"));
  assert.deepEqual(names("README.md", "function x() {"), []);
});
