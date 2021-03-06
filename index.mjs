import Vue from 'https://unpkg.com/vue@2.6.12/dist/vue.esm.browser.min.js'
import analyticsScript from './base/analyticsScript.mjs'
import {
  createElement,
  queryFor,
  queryAll,
  getTemplateContents,
  fetchTextContent,
  fetchTemplateFromScript,
  domContentLoadedPromise
} from './util/index.js'

const getConfig = async () => {
  const scriptEl = queryFor('script[data-config]')
  const templateEl = await fetchTemplateFromScript(scriptEl)
  const jsonScriptEl = templateEl.content.firstElementChild
  window.document.body.append(jsonScriptEl)
  scriptEl.remove()
  const jsonString = jsonScriptEl.innerHTML
  return JSON.parse(jsonString.replace(/"@/g, '"'))
}

const registerComponents = async () => {
  const componentScriptEls = queryAll('script[data-component]')

  return await Promise.all(componentScriptEls.map(async scriptEl => {
    const templateEl = await fetchTemplateFromScript(scriptEl)
    const template = getTemplateContents(templateEl)
    const props = templateEl.getAttribute('data-props')
      .split(',')
      .map(string => string.trim())
    const name = templateEl.getAttribute('data-name')
    Vue.component(name, {
      inheritAttrs: false,
      props,
      template
    })
    scriptEl.remove()
  }))
}

const getHeadTemplate = async () => {
  const el = queryFor('script[data-head]')
  const template = await fetchTemplateFromScript(el)
    .then(getTemplateContents)
  el.remove()
  return template
}

const renderHead = async config => {
  const template = await getHeadTemplate()
  const el = createElement('div')
  window.document.body.prepend(el)
  
  new Vue({
    el,
  	data: () => ({
  		config: {
  			...config
  		}
  	}), 
    template,
    mounted() {
      ;[...this.$el.children].forEach(el => {
        window.document.head.append(el)
      })
      this.$destroy()
    },
    beforeDestroy() {
      this.$el.remove()
    }
  })
}

const getBodyTemplate = async () => {
  const el = queryFor('script[data-body]')
  const template = await fetchTemplateFromScript(el)
    .then(getTemplateContents)
  el.remove()
  return template
}

const renderBody = async config => {
  const template = await getBodyTemplate()
  const el = createElement('div')
  window.document.body.prepend(el)

  return new Vue({
    el,
    data: () => ({
      config: {
        ...config
      }
    }),
    template
  })
}

const render = async config => {
  await registerComponents()
  await Promise.all([
    renderBody(config),
    renderHead(config),
  ])
  return config
}

const inlineStyles = async () => {
  const styleSheetEl = queryFor('link[rel="stylesheet"]')
  const style = await fetchTextContent(styleSheetEl.getAttribute('href'))
  const styleEl = createElement('style')
  styleEl.innerHTML = style
  styleSheetEl.parentElement.replaceChild(styleEl, styleSheetEl)
}

const prepareOutput = async ({
  identifier,
  knowsLanguage: [{
    alternateName: lang
  }]
}) => {
  await inlineStyles()
  queryFor('script[type="module"]').remove()

  return `
    <!doctype html>
    <html lang="${lang}">
      <head>
        ${window.document.head.innerHTML}
      </head>
      <body>
        ${window.document.body.innerHTML}
        ${analyticsScript({ identifier })}
        <script type="module">
          ;[...window.document.querySelectorAll('details')].forEach((details) => {
            if (details.open) {
              details.querySelector('disclosure-triangle').setAttribute('open', '');
            }
            details.addEventListener('toggle', () => {
              if (details.open) {
                details.querySelector('disclosure-triangle').setAttribute('open', '');
              } else {
                details.querySelector('disclosure-triangle').removeAttribute('open');
              }
            });
          });
        </script>
        <script type="module">
          ;[...window.document.querySelectorAll('section .property-description')].forEach(element => {
            element.addEventListener('click', ({ currentTarget: element }) => {
              const details = element.closest('details');
              details.open = !details.open;
            })
          })
        </script>
      </body>
    </html>
  `
}

const addDownloadLink = html => {
  const file = new File([ html ], 'index.html', {
    type: 'text/html'
  })
  const url = window.URL.createObjectURL(file)
  const downloadLinkEl = createElement('a')
  downloadLinkEl.setAttribute('download', 'index.html')
  downloadLinkEl.innerText = 'Download'
  downloadLinkEl.setAttribute('href', url)
  downloadLinkEl.style.position = 'fixed'
  downloadLinkEl.style.top = '10px'
  downloadLinkEl.style.right = '10px'
  downloadLinkEl.style.backgroundColor = 'var(--swatch-text-color)'
  downloadLinkEl.style.color = 'var(--swatch-background-color)'
  downloadLinkEl.style.padding = '5px 10px'
  downloadLinkEl.setAttribute('data-hide-from-print', '')
  window.document.body.appendChild(downloadLinkEl)
}

domContentLoadedPromise
  .then(getConfig)
  .then(render)
  .then(prepareOutput)
  .then(addDownloadLink)
