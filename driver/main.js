const CDP = require('chrome-remote-interface');
const fs = require("fs");

const URL = process.env.URL || "";


// ===========================================================================
class Injector {
  async init(frameId) {
    if (frameId) {
      let resp = await Page.createIsolatedWorld({frameId, worldName: "Behavior", grantUniversalAccess: true});

      this.contextId = resp.executionContextId;
    } else {
      this.contextId = null;
    }
  }

  async runScript(text, name) {
    const executionContextId = this.contextId;

    let params = {
      expression: text,
      sourceURL: "file:///" + name,
      persistScript: true,
    };

    if (executionContextId) {
      opts.executionContextId = executionContextId;
    }

    let resp = await Runtime.compileScript(params);

    const scriptId = resp.scriptId;

    params = {scriptId};

    if (executionContextId) {
      opts.executionContextId = executionContextId;
    }

    resp = await Runtime.runScript(params);
  }
}


async function main() {
  let client;
  let resp;

  try {
    // connect to endpoint
    client = await CDP();
    
    // extract domains
    const {Network, Page, Runtime, Debugger} = client;

    global.Network = client.Network;
    global.Page = client.Page;
    global.Runtime = client.Runtime;
    global.Debugger = client.Debugger;
    
    await Page.enable();
    await Runtime.enable();
    await Debugger.enable();

    resp = await Page.navigate({url: URL});

    const injector = new Injector();
    await injector.init();

    const script = fs.readFileSync("./lib.js", {encoding: "utf-8"});

    await injector.runScript(script, "BehaviorLib");

  } catch (err) {
    console.error(err);
  } finally {
    if (client) {
      await client.close();
    }
    await new Promise((resolve) => setTimeout(resolve, 6000000));

    //exitBrowser();
  }
}

function exitBrowser() {
  if (process.env.EXIT_FILE) {
    console.log("Creating exit file: " + process.env.EXIT_FILE);
    fs.closeSync(fs.openSync(process.env.EXIT_FILE, "w"));
  }
}

main();

