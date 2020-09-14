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
    this.cdp = null;
    this.numRetries = 0;
  }

  static get properties() {
    return {
      contents: { type: String },

      jobid: { type: String },
    }
  }

  firstUpdated() {
    const vertOpts = {
      gutterSize: 4,
      sizes: [40, 60],
      minSize: [100, 100],
      direction: "vertical"
    };

    const horzOpts = {
      gutterSize: 4,
      sizes: [50, 50],
      minSize: [100, 100],
      direction: "horizontal"
    };

    this.configureSplitter("editorBrowserSplitter", ".editors", "#browser-view", horzOpts);
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
      <!-- form input with Spectre icon -->
      <div class="main">
        <div class="editors">
          <div class="browser-header">
            <div class="form-group">
              <div class="url-group">
                <span>URL&nbsp;</span>
                <input id="url" type="text" class="form-input" value="https://example.com/" placeholder="https://...">
              </div>
            </div>
            <div class="form-group">
              <label class="form-label form-inline">Crawl Behavior</label>&nbsp;
              <select class="form-select">
                <option value="single-page">Single Page</option>
              </select>
              <span class="run-controls">
                <button class="btn" ?disabled="${!!this.jobid}" @click="${this.onStart}">
                  <i class="fas fa-play"></i>
                </button>
                <button class="btn" ?disabled="${!this.jobid}" @click="${this.onStop}">
                  <i class="fas fa-stop"></i>
                </button>
                <button class="btn" ?disabled="${!this.jobid}" @click="${this.onRestart}">
                  <i class="fas fa-redo-alt"></i>
                </button>
              </span>
            </div>
          </div>
          <div id="browser-editor" class="editor">
            <wc-codemirror src="${this.crawlScript}" mode="javascript">
            </wc-codemirror>
          </div>
          <div id="page-editor" class="editor">
            <wc-codemirror mode="javascript">
            </wc-codemirror>
          </div>
        </div>
        <div id="browser-view">
          ${!this.jobid ? html`
          <p class="no-browsers">No Browser Connected</p>` : html`
          <iframe src="${this.apiPrefix}/attach/${this.jobid}"></iframe>`}
        </div>
      </div>
      `;
  }

  async onStart() {
   const res = await fetch(`${this.apiPrefix}/create/chrome:84`, {method: "POST"});
   const data = await res.json();
   this.jobid = data.jobid;
   this.connect();
  }

  async onStop() {
    this.jobid = "";
    this.cdp.close();
  }

  async connect() {
    this.numRetries = 0;
    this.cdp = new CDP(`${this.apiPrefix}/cdp/${this.jobid}`);
    this.cdp.ondisconnect(() => {
      console.log("disconnected");
      if (!this.jobid) {
        return;
      }
      this.numRetries++;

      if (this.numRetries < 4) {
        this.connect();
        console.log("Retrying...");
      } else {
        this.onStop();
      }
    });

    try {
      await this.cdp.connect();
    } catch (e) {
      console.log(e);
    }

    this.numRetries = 0;

    const code = document.querySelector("#browser-editor wc-codemirror").value;

    const url = document.querySelector("#url").value;

    this.cdp.eval(code, {"URL": url});
  }
}

customElements.define('wr-editor', Editor);

export { CDP };
