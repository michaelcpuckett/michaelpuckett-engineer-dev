<template>
  <main>
    <nav>
      <a href="mailto:michael@puckett.contact">
        michael@puckett.contact
      </a>
      <a href="michael_puckett_resume.pdf">
        Résumé
      </a>
    </nav>
    <header>
      <h1>
        <span class="h1-name">
          {{ name }}
        </span>
        <span class="h1-title">
          {{ jobTitle }}
        </span>
      </h1>
      <p v-for="paragraph of description" :key="paragraph">
        {{ paragraph }}
      </p>
    </header>
    <section aria-labelledby="section-header-skills">
      <h2 id="section-header-skills">
        Skills
      </h2>
      <ol role="list">
        <li v-for="skill of knowsAbout" :key="skill.name">
          <details @click="handleDetailsClick">
            <summary>
              <span>
                {{ skill.name }}
              </span>
            </summary>
            <div>
              <p v-for="paragraph of skill.description" :key="paragraph">
                {{ paragraph }}
              </p>
            </div>
          </details>
        </li>
      </ol>
    </section>
    <section aria-labelledby="section-header-experience">
      <h2 id="section-header-experience">
        Experience
      </h2>
      <ol role="list">
        <li
          v-for="work of worksFor.filter(work => Number(work.startDate) >= 2010)"
          :key="work.worksFor.name"
        >
          <details @click="handleDetailsClick">
            <summary>
              <span>
                {{ work.worksFor.name }}, {{ work.roleName }}
              </span>
            </summary>
            <div>
              <dl>
                <template v-if="work.startDate">
                  <dt>
                    Start Date
                  </dt>
                  <dd>
                    {{ work.startDate }}
                  </dd>
                </template>
                <template v-if="work.endDate">
                  <dt>
                    End Date
                  </dt>
                  <dd>
                    {{ work.endDate }}
                  </dd>
                </template>
              </dl>
              <p v-for="paragraph of work.description" :key="paragraph">
                {{ paragraph }}
              </p>
            </div>
          </details>
        </li>
      </ol>
    </section>
    <section aria-labelledby="section-header-education">
      <h2 id="section-header-education">
        Education
      </h2>
      <ol role="list">
        <li v-for="school of alumniOf" :key="school.alumniOf.name">
          <details @click="handleDetailsClick">
            <summary>
              <span>
                {{ school.alumniOf.name }}, {{ school.roleName }}
              </span>
            </summary>
            <div>
              <dl>
                <template v-if="school.startDate">
                  <dt>
                    Start Date
                  </dt>
                  <dd>
                    {{ school.startDate }}
                  </dd>
                </template>
                <template v-if="school.endDate">
                  <dt>
                    End Date
                  </dt>
                  <dd>
                    {{ school.endDate }}
                  </dd>
                </template>
              </dl>
              <p v-for="paragraph of school.description" :key="paragraph">
                {{ paragraph }}
              </p>
            </div>
          </details>
        </li>
      </ol>
    </section>
  </main>
</template>

<script lang="ts">
import Vue from 'vue'
import json from '../static/data.json'

export default Vue.extend({
  name: 'IndexPage',
  data: () => json,
  head: {
    title: 'Michael Puckett - UX Engineer - CV',
    meta: [
      {
        hid: 'description',
        name: 'description',
        content: 'I’m a creative technologist with over 10 years of professional JavaScript experience and an educational background in graphic design.'
      }
    ],
    script: [
      {
        body: true,
        src: 'https://www.googletagmanager.com/gtag/js?id=UA-128368551-1',
        async: true
      },
      {
        body: true,
        innerHTML: `
          window.dataLayer = window.dataLayer || [];
          function gtag(){dataLayer.push(arguments);}
          gtag('js', new Date());
          gtag('config', 'UA-128368551-1');
        `
      },
      {
        body: true,
        type: 'application/ld+json',
        innerHTML: JSON.stringify(json)
      }
    ],
    __dangerouslyDisableSanitizers: ['script']
  },
  methods: {
    handleDetailsClick (event: MouseEvent) {
      const target = event.target
      const currentTarget = event.currentTarget

      if (!(target instanceof HTMLElement) || !(currentTarget instanceof HTMLElement) || target.closest('summary')) {
        return
      }

      const summaryEl = currentTarget.querySelector<HTMLElement>('summary')

      if (summaryEl) {
        summaryEl.click()
      }
    }
  }
})
</script>

<style>
  * {
    box-sizing: border-box;
    -webkit-text-size-adjust: 100%;
  }

  :root {
    font-family: 'system-ui', sans-serif;
    line-height: 1.4;
    font-size: 100%;
    --swatch-text-color: CanvasText;
    --swatch-background-color: Canvas;
    --swatch-gray: GrayText;
    --swatch-interactive: LinkText;
    --swatch-interactive-completed: VisitedText;
    --swatch-focused: Highlight;
    --swatch-button-text: CanvasText;
    --swatch-page: #242424;
    --swatch-button-face: #f0f0f0;
  }

  @media (forced-colors: active) {
    :root {
      --swatch-page: Canvas;
      --swatch-button-face: Canvas;
    }
  }

  body {
    background: var(--swatch-page);
    color: var(--swatch-text-color);
    margin: 0;
    padding: 0;
    font-size: 20px;
  }

  main {
    display: grid;
    --gap: 2.5em;
    background: var(--swatch-background-color);
    width: 100%;
    max-width: min(calc(100% - 2em), 860px);
    margin: 0 auto var(--gap);
    padding: 3em;
    display: grid;
    grid-gap: var(--gap);
    border-radius: 1em;
    justify-self: center;
    box-shadow: 0 0 2em rgba(0, 0, 0, .125);
    grid-template-columns: 100%;
  }

  @media (max-width: 959px) {
    main {
      margin: 0 auto;
      padding: 2em;
      max-width: 100%;
      border-radius: 0;
    }
  }

  @media (min-width: 960px) {
    main {
      margin-top: 5em;
    }
  }

  nav {
    display: flex;
    flex-wrap: wrap;
    gap: 1em;
    justify-content: space-between;
  }

  .h1-name {
    font-size: 2em;
    font-weight: bold;
    line-height: 1;
  }

  .h1-title {
    letter-spacing: 2px;
    text-transform: uppercase;
    line-height: 1.25;
    font-size: 1.25em;
  }

  header {
    display: grid;
    justify-content: center;
  }

  p {
    margin: 1em 0 0;
  }

  a {
    color: var(--swatch-interactive);
    text-align: center;
    font-weight: bold;
    font-size: .875em;
  }

  /* hidden items */

  [hidden] {
    display: none !important;
  }

  .visually-hidden {
    position: absolute;
    width: 1px;
    height: 1px;
    white-space: nowrap;
    clip: rect(0 0 0 0);
    margin: -1px;
    border: 0;
    padding: 0;
    -webkit-user-select: none;
    user-select: none;
  }

  /* focus styles */

  :focus {
    outline-offset: 4px;
    outline: 4px solid var(--swatch-focused);
  }

  /* headings */

  h1,
  h2,
  h3 {
    font-weight: normal;
    line-height: inherit;
    margin: 0;
  }

  h1 {
    display: flex;
    flex-direction: column;
    align-content: stretch;
    justify-self: flex-start;
    font-size: 1.5rem;
    row-gap: .5em;
    column-gap: 1em;
    width: 100%;
    letter-spacing: -.05rem;
  }

  h2 {
    line-height: 1;
    letter-spacing: -.025rem;
    font-size: 2rem;
    border-bottom: 2px solid;
    padding-bottom: .25em;
  }

  /* interactive items */

  button {
    all: unset;
    box-sizing: border-box;
    -webkit-appearance: none;
    appearance: none;
    color: var(--swatch-interactive);
    cursor: pointer;
    display: grid;
  }

  ol {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    grid-gap: calc(.5 * var(--gap));
    margin-top: calc(.5 * var(--gap));
  }

  details {
    cursor: pointer;
    border-radius: 1em;
    padding: 1.5em;
    box-shadow: 0.1em 0.1em 0.1em rgb(0 0 0 / 25%);
    background-color: var(--swatch-button-face);
  }

  summary {
    font-weight: bold;
    color: var(--swatch-interactive);
  }

  summary span {
    color: var(--swatch-text-color);
  }

  summary:focus {
    outline: 0;
  }

  details:focus-within {
    outline: 4px solid var(--swatch-focused);
  }

  dl {
    display: flex;
  }

  dt {
    clip: rect(1px,1px,1px,1px);
    height: 1px;
    overflow: hidden;
    position: absolute;
    width: 1px;
  }

  dd {
    padding: 0;
    margin: 0;
    font-size: .875em;
  }

  dd:first-of-type:after {
    content: '–\00a0';
  }

  dd:first-of-type:last-of-type:after {
    content: '– Present';
  }
</style>
