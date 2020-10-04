import { LitElement, html, css, unsafeCSS, styles } from 'lit-element';

import { CDP } from './cdp.js';

import Split from 'split.js';


// ===========================================================================
class Editor extends LitElement
{
  constructor() {
    super();
    this.apiPrefix = __API_PREFIX__ || window.location.origin;
    
    this.contents = "";

    this.crawlScript = "./scripts/crawl/single-page.js";

    this.jobid = "";
    this.loading = false;

    this.useNodeDevTools = false;

    this.browserDevtoolsUrl = "";
    this.nodeDevtoolsUrl = "";

    this.initDevToolsOpts();

    window.addEventListener('beforeunload', () => {
      this.onStop();
    });
  }

  initDevToolsOpts() {
    window.localStorage["uiTheme"] = '"light"';
    window.localStorage["prettyPrintInfobarDisabled"] = '"true"';
    window.localStorage["navigator-view-selectedTab"] = '"navigator-contentScripts"';
    window.localStorage["panel-selectedTab"] = '"sources"';
    window.localStorage["sourcesPanelNavigatorSplitViewState"] = `{"vertical":{"size":0,"showMode":"OnlyMain"}}`;
    window.localStorage["InspectorView.screencastSplitViewState"] = `{"vertical":{"size":679}}`;

    this.initSnippetText(`
// Enter Behavior here
// You can use the behavior functions library, installed under 'lib.'
    
    `, "Behavior");
  }

  initSnippetText(content, name) {
    const snippet = [{name, content}];
    const lastViewed = [{"url":`snippet:///${name}`,"selectionRange":{"startLine":0,"startColumn":0,"endLine":0,"endColumn":0}}];

    window.localStorage["scriptSnippets"] = JSON.stringify(snippet);
    window.localStorage["previouslyViewedFiles"] = JSON.stringify(lastViewed);
 
    //scriptSnippets_lastIdentifier: "2"
  }

  static get properties() {
    return {
      contents: { type: String },

      jobid: { type: String },
      loading: { type: Boolean },

      browserDevtoolsUrl: { type: String },
      nodeDevtoolsUrl: { type: String }
    }
  }

  firstUpdated() {
    if (!this.useNodeDevTools) {
      return;
    }

    const vertOpts = {
      gutterSize: 4,
      sizes: [40, 60],
      minSize: [50, 50],
      direction: "vertical"
    };

    this.configureSplitter("editorsSplitter", "#browser-editor", "#page-editor", vertOpts);
  }

  createRenderRoot() {
    return this;
  }

  configureSplitter(name, firstQ, secondQ, opts) {
    const first = this.renderRoot.querySelector(firstQ);
    const second = this.renderRoot.querySelector(secondQ);

    if (!this[name]) {
      this[name] = Split([first, second], opts);
    } else if (this[name]) {
      try {
        this[name].destroy();
      } catch (e) {}
      this[name] = null;
    }
  }

  render() {
    return html`
      <div class="main">
        <div class="editors">
          <div class="browser-header">
            <div class="form-group url-group">
              <label class="form-label form-inline">URL&nbsp;
              </label>
              <span class="flex-auto has-icon-right">
                <input id="url" type="text" class="form-input form-inline" value="https://example.com/" placeholder="https://...">
                ${this.loading ? html`
                <i class="form-icon loading"></i>` : ``}
              </span>
              <span class="run-controls">
                <button class="btn" ?disabled="${this.jobid}" @click="${this.onStart}">
                  <i class="fas fa-play"></i>
                </button>
                <button class="btn" ?disabled="${!this.jobid || this.loading}" @click="${this.onRestart}">
                  <i class="fas fa-redo-alt"></i>
                </button>
                <button class="btn" ?disabled="${!this.jobid}" @click="${this.onStop}">
                  <i class="fas fa-stop"></i>
                </button>
              </span>
            </div>
          </div>
          ${this.useNodeDevTools ? html`
            <div id="browser-editor" class="editor">
            ${!this.nodeDevtoolsUrl ? html`
              <p class="no-browsers">${this.loading ? "Loading Driver Devtools..." : "No Driver Connected"}</p>` : html`
              <iframe src="${this.nodeDevtoolsUrl}"></iframe>`}
            </div>` : ``}
          <div id="page-editor" class="editor">
            ${!this.browserDevtoolsUrl ? html`
            <p class="no-browsers">${this.loading ? "Loading Browser Devtools..." : "No Browser Connected"}</p>` : html`
            <iframe src="${this.browserDevtoolsUrl}"></iframe>`}
          </div>
        </div>
      </div>
      `;
  }

  async getDevToolsURL(port, type, devtoolsPage) {
    const NUM_TRIES = 8;

    let json = null;

    let numRetries = 0;
    let waitTime = 500;

    const fullPrefix = `${this.apiPrefix}/cdp/${this.jobid}/${port}`;

    const devToolsPrefix = `${this.apiPrefix}/cdp/${this.jobid}/${9222}/${devtoolsPage}`;

    const jobid = this.jobid;

    while (++numRetries < NUM_TRIES) {
      try {
        const resp = await fetch(fullPrefix + "/json");
        json = await resp.json();
        break;
      } catch (e) {
        console.log("Retrying", e);
        if (numRetries === NUM_TRIES) {
          return "";
        }
        await new Promise((resolve) => setTimeout(resolve, waitTime));
        waitTime *= 2;
        // job was canceled
        if (this.jobid !== jobid) {
          return;
        }
      }
    }

    for (const entry of json) {
      if (entry.type === type) {
        const url = new URL(entry.webSocketDebuggerUrl);
        return devToolsPrefix + fullPrefix.replace("http", "ws").replace("://", "=") + url.pathname;
      }
    }

    return "";
  }

  async onStart() {
    const url = document.querySelector("input").value;

    const res = await fetch(`${this.apiPrefix}/create/chrome:84/${url}`, {method: "POST"});
    const data = await res.json();
    this.jobid = data.jobid;
    this.loading = true;
    this.connect();
  }

  async onStop() {
    if (this.jobid) {
      const res = await fetch(`${this.apiPrefix}/browser/${this.jobid}`, {method: "DELETE"});

      this.jobid = "";
    }

    this.browserDevtoolsUrl = "";
    this.nodeDevtoolsUrl = "";
    this.loading = false;
  }

  async onRestart() {
    await this.onStop();
    await this.onStart();
  }

  async connect() {
    this.browserDevtoolsUrl = await this.getDevToolsURL(9222, "page", "devtools/inspector.html?");
    if (this.useNodeDevTools) {
      this.nodeDevtoolsUrl = await this.getDevToolsURL(9229, "node", "devtools/js_app.html?experiments=true&v8only=true&");
    }
    this.loading = false;
  }
}

customElements.define('wr-editor', Editor);

export { CDP };
