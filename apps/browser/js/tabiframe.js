/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/. */

/**
 * tabiframe.js
 *
 * tabiframe implements the <tab-iframe> tab. It's a wrapper
 * around a <iframe mozbrowser>.
 *
 */

define(['js/eventemitter'], function(EventEmitter) {

  'use strict';

  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 2;

  const IFRAME_EVENTS = [
    'mozbrowserasyncscroll', 'mozbrowserclose', 'mozbrowsercontextmenu',
    'mozbrowsererror', 'mozbrowsericonchange', 'mozbrowserloadend',
    'mozbrowserloadstart', 'mozbrowserlocationchange', 'mozbrowseropenwindow',
    'mozbrowsersecuritychange', 'mozbrowsershowmodalprompt', 'mozbrowsertitlechange',
    'mozbrowserusernameandpasswordrequired', 'mozbrowsermetachange'
  ];

  let tabIframeProto = Object.create(HTMLElement.prototype);

  tabIframeProto.setLocation = function(url) {
    if (!this._innerIframe) {
      this._createInnerIframe();
    }
    if (window.IS_PRIVILEGED) {
      this._innerIframe.src = url;
    } else {
      this._innerIframe.src = 'data:,' + url;
    }
  };

  tabIframeProto.willBeVisibleSoon = function() {
    if (window.IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(true);
    }
  };

  tabIframeProto.show = function() {
    this.removeAttribute('hidden');
    if (window.IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(true);
    }
    this.emit('visible');
  };

  tabIframeProto.hide = function() {
    this.setAttribute('hidden', 'true');
    if (window.IS_PRIVILEGED && this._innerIframe) {
      this._innerIframe.setVisible(false);
    }
    this.emit('hidden');
  };

  tabIframeProto.createdCallback = function() {
    this._zoom = 1;
    this._clearTabData();
    EventEmitter.decorate(this);
  };

  tabIframeProto._createInnerIframe = function() {
    let iframe = document.createElement('iframe');
    iframe.setAttribute('mozbrowser', 'true');
    iframe.setAttribute('remote', 'true');
    iframe.setAttribute('mozallowfullscreen', 'true');
    this.appendChild(iframe);
    for (let eventName of IFRAME_EVENTS) {
      iframe.addEventListener(eventName, this);
    }
    this._innerIframe = iframe;
    this._applyZoom();
  };

  tabIframeProto.attachedCallback = function() {
  };

  tabIframeProto.detachedCallback = function() {
    if (this._innerIframe) {
      for (let eventName of IFRAME_EVENTS) {
        this._innerIframe.removeEventListener(eventName, this);
      }
    }
  };

  tabIframeProto.zoomIn = function() {
    this._zoom += 0.1;
    this._zoom = Math.min(MAX_ZOOM, this._zoom);
    this._applyZoom();
  };

  tabIframeProto.zoomOut = function() {
    this._zoom -= 0.1;
    this._zoom = Math.max(MIN_ZOOM, this._zoom);
    this._applyZoom();
  };

  tabIframeProto.resetZoom = function() {
    this._zoom = 1;
    this._applyZoom();
  };

  tabIframeProto._applyZoom = function() {
    if (this._innerIframe && window.IS_PRIVILEGED) {
      this._innerIframe.zoom(this._zoom);
    }
  };

  tabIframeProto.reload = function() {
    if (this._innerIframe) this._innerIframe.reload();
  };

  tabIframeProto.stop = function() {
    if (this._innerIframe) this._innerIframe.stop();
  };

  tabIframeProto.goBack = function() {
    if (this._innerIframe) this._innerIframe.goBack();
  };

  tabIframeProto.goForward = function() {
    if (this._innerIframe) this._innerIframe.goForward();
  };

  tabIframeProto._clearTabData = function() {
    this._loading = false;
    this._title = '';
    this._location = '';
    this._favicon = '';
    this._securityState = 'insecure';
    this._securityExtendedValidation = false;
  };

  tabIframeProto._buildThumbnail = function(iconURL) {
    const MAXIMUM_PIXELS = Math.pow(300, 2);
    let blobURL;
    let image = document.createElement("img");

    let xhr = new XMLHttpRequest({ mozSystem: true, mozAnon: true });
    xhr.open('GET', iconURL);
    xhr.responseType = 'blob';
    xhr.send();
    xhr.onload = function() {
      blobURL = window.URL.createObjectURL(xhr.response);
      image.src = blobURL;
    };

    image.onload = () => {
      if (image.naturalWidth * image.naturalHeight > MAXIMUM_PIXELS) {
        // this will probably take too long to process - fail
        window.URL.revokeObjectURL(blobURL);
      } else {
        let canvas = document.createElement("canvas");
        canvas.width = image.naturalWidth;
        canvas.height = image.naturalHeight;
        let ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0);
        let worker = new Worker("/js/colors/ColorAnalyzer_worker.js");
        let imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        worker.postMessage({ imageData: imageData, maxColors: 1 });
        worker.onmessage = (event) => {
          window.URL.revokeObjectURL(blobURL);
          if (event.data.colors.length < 1) {
            // Fail
            console.log("fail");
          } else {
            console.log(iconURL);
            console.log("#" + event.data.colors[0].toString(16));
          }
        }
      }
    }
  };

  Object.defineProperty(tabIframeProto, 'loading', {
    get: function() {
      return this._loading;
    }
  });

  Object.defineProperty(tabIframeProto, 'title', {
    get: function() {
      return this._title;
    }
  });

  Object.defineProperty(tabIframeProto, 'location', {
    get: function() {
      return this._location;
    }
  });

  Object.defineProperty(tabIframeProto, 'favicon', {
    get: function() {
      return this._favicon;
    }
  });

  Object.defineProperty(tabIframeProto, 'color', {
    get: function() {
      return this._color;
    }
  });

  Object.defineProperty(tabIframeProto, 'securityState', {
    get: function() {
      return this._securityState;
    }
  });

  Object.defineProperty(tabIframeProto, 'securityExtendedValidation', {
    get: function() {
      return this._securityExtendedValidation;
    }
  });

  tabIframeProto.canGoBack = function() {
    return new Promise((resolve, reject) => {
      if (!this._innerIframe) {
        return resolve(false);
      }
      this._innerIframe.getCanGoBack().onsuccess = r => {
        return resolve(r.target.result);
      };
    });
  };

  tabIframeProto.canGoForward = function() {
    return new Promise((resolve, reject) => {
      if (!this._innerIframe) {
        return resolve(false);
      }
      this._innerIframe.getCanGoForward().onsuccess = r => {
        return resolve(r.target.result);
      };
    });
  };

  tabIframeProto.focus = function() {
    if (this._innerIframe) {
      this._innerIframe.focus();
    }
  };

  tabIframeProto.userInput = '';

  tabIframeProto.handleEvent = function(e) {
    switch (e.type) {
      case 'mozbrowserloadstart':
        this._clearTabData();
        this._loading = true;
        break;
      case 'mozbrowserloadend':
        this._loading = false;
        break;
      case 'mozbrowsertitlechange':
        this._title = e.detail;
        break;
      case 'mozbrowserlocationchange':
        this._color = '';
        this.userInput = '';
        this._location = e.detail;
        break;
      case 'mozbrowsericonchange':
        this._favicon = e.detail.href;
        console.log(e.detail.size);
        this._buildThumbnail(e.detail.href);
        break;
      case 'mozbrowsererror':
        this._loading = false;
        break;
      case 'mozbrowsersecuritychange':
        this._securitystate = e.detail.state;
        this._securityextendedvalidation = e.detail.extendedvalidation;
        break;
      case 'mozbrowsermetachange':
        if (e.detail.name == 'theme-color' && e.detail.type) {
          this._color = '';
          if (e.detail.type !== 'removed') {
            this._color = e.detail.content;
          }
        }
        break;
    }

    // Forward event
    this.emit(e.type, e, this);
  };

  let TabIframe = document.registerElement('tab-iframe', {prototype: tabIframeProto});
  return TabIframe;
});
