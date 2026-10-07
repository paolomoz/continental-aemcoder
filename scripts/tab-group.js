/*
 * Shared tab grouping for blocks with a `tabbed` option (cards-latest-news, cards-teaser).
 *
 * Adjacent tabbed instances of the same block in one section share one ARIA tab bar.
 * Each instance's wrapper becomes a tab panel; the tab label is the block's own heading
 * (a heading row inside the block) or, when the block has none, a heading that directly
 * precedes it as the last element of the default content before the block.
 * Whichever instance decorates first builds the group for the whole run; the others skip.
 * A single tabbed instance (or no JS) simply stacks with its heading.
 *
 * Generated class names (prefix = block name): `{block}-tablist`, `{block}-tab`,
 * `{block}-in-tabs` (on each grouped block), `{block}-tab-heading` (a moved preceding
 * heading, hidden because the tab now carries the label).
 */

let groupCount = 0;

const HEADING = /^H[1-6]$/;

/**
 * The heading that directly precedes `wrapper` as the last element of a default-content
 * wrapper, or null.
 */
function precedingHeading(wrapper) {
  const prev = wrapper.previousElementSibling;
  if (!prev || !prev.classList.contains('default-content-wrapper')) return null;
  const last = prev.lastElementChild;
  return last && HEADING.test(last.tagName) ? last : null;
}

function selectTab(tabs, index, focus = false) {
  tabs.forEach((tab, i) => {
    const selected = i === index;
    tab.setAttribute('aria-selected', selected);
    tab.tabIndex = selected ? 0 : -1;
    const panel = document.getElementById(tab.getAttribute('aria-controls'));
    if (panel) panel.hidden = !selected;
  });
  if (focus) tabs[index].focus();
}

/**
 * Groups the run of adjacent tabbed instances around `block` into one tab bar.
 * Call synchronously at the start of decorate(), while sibling instances are still
 * undecorated (their headings are still in the DOM).
 * @param {Element} block the block being decorated
 * @param {object} opts
 * @param {string} opts.blockName block class, e.g. 'cards-teaser'
 * @param {string} [opts.option] option class that marks a tabbed instance
 * @param {boolean} [opts.precedingHeadings] also use a heading directly before a block
 * @param {function(Element): (Element|null)} [opts.getHeading] the block's own label heading
 *   (default: the first heading anywhere in the block)
 * @returns {boolean} true when this call built a group
 */
export default function groupTabbedBlocks(block, {
  blockName, option = 'tabbed', precedingHeadings = false,
  getHeading = (el) => el.querySelector('h1, h2, h3, h4, h5, h6'),
}) {
  const wrapperClass = `${blockName}-wrapper`;
  const ownHeading = (wrapperEl) => {
    const blockEl = wrapperEl.querySelector(`:scope > .${blockName}`);
    return blockEl ? getHeading(blockEl) : null;
  };

  const isTabbed = (el) => !!el
    && el.classList.contains(wrapperClass)
    && !!el.querySelector(`:scope > .${blockName}.${option}`);

  // a tabbed wrapper may be preceded by a lone label heading in its own default content
  const labelBefore = (el) => (precedingHeadings && !ownHeading(el) ? precedingHeading(el) : null);

  // the element that comes before `el` in the run (skipping its label heading's wrapper)
  const prevInRun = (el) => {
    const label = labelBefore(el);
    const prev = el.previousElementSibling;
    if (label && prev.children.length === 1) return prev.previousElementSibling;
    return label ? null : prev;
  };
  // the next tabbed wrapper after `el`, allowing one heading-only wrapper in between
  const nextInRun = (el) => {
    const next = el.nextElementSibling;
    if (isTabbed(next)) return next;
    if (precedingHeadings && next?.classList.contains('default-content-wrapper')
      && next.children.length === 1 && HEADING.test(next.firstElementChild.tagName)
      && isTabbed(next.nextElementSibling) && !ownHeading(next.nextElementSibling)) {
      return next.nextElementSibling;
    }
    return null;
  };

  const wrapper = block.parentElement;
  if (!isTabbed(wrapper) || wrapper.dataset.tabGroup) return false;

  let first = wrapper;
  for (let prev = prevInRun(first); isTabbed(prev); prev = prevInRun(first)) first = prev;
  const run = [];
  for (let el = first; el; el = nextInRun(el)) run.push(el);
  if (run.length < 2) return false;

  groupCount += 1;
  const groupId = `${blockName}-tabs-${groupCount}`;
  const tablist = document.createElement('div');
  tablist.className = `${blockName}-tablist`;
  tablist.setAttribute('role', 'tablist');

  // the tab bar goes where the run starts (before the first label heading, if any)
  const firstLabel = labelBefore(first);
  const anchor = firstLabel && firstLabel.parentElement.children.length === 1
    ? firstLabel.parentElement : first;

  const tabs = run.map((panel, idx) => {
    const panelBlock = panel.querySelector(`:scope > .${blockName}`);
    let heading = ownHeading(panel);
    if (!heading) {
      heading = labelBefore(panel);
      if (heading) {
        // move the label heading into its panel so it travels (and hides) with it
        const source = heading.parentElement;
        heading.classList.add(`${blockName}-tab-heading`);
        // the tab is the visible label now; the panel is labelled by the tab
        heading.hidden = true;
        panel.prepend(heading);
        if (!source.children.length && source !== anchor) source.remove();
      }
    }
    const label = heading?.textContent.trim() || `Tab ${idx + 1}`;

    panel.dataset.tabGroup = groupId;
    panel.id = `${groupId}-panel-${idx}`;
    panel.setAttribute('role', 'tabpanel');
    panel.setAttribute('aria-labelledby', `${groupId}-tab-${idx}`);
    panel.tabIndex = 0;
    panelBlock.classList.add(`${blockName}-in-tabs`);

    const tab = document.createElement('button');
    tab.type = 'button';
    tab.className = `${blockName}-tab`;
    tab.id = `${groupId}-tab-${idx}`;
    tab.setAttribute('role', 'tab');
    tab.setAttribute('aria-controls', panel.id);
    tab.textContent = label;
    tablist.append(tab);
    return tab;
  });

  tablist.addEventListener('click', (e) => {
    const tab = e.target.closest('[role="tab"]');
    if (tab) selectTab(tabs, tabs.indexOf(tab));
  });
  tablist.addEventListener('keydown', (e) => {
    const current = tabs.indexOf(document.activeElement);
    if (current < 0) return;
    const moves = {
      ArrowRight: current + 1, ArrowLeft: current - 1, Home: 0, End: tabs.length - 1,
    };
    if (!(e.key in moves)) return;
    e.preventDefault();
    selectTab(tabs, (moves[e.key] + tabs.length) % tabs.length, true);
  });

  if (anchor !== first) {
    // the first label heading's wrapper is now empty: the tab bar takes its place
    anchor.replaceWith(tablist);
  } else {
    first.before(tablist);
  }
  selectTab(tabs, 0);
  return true;
}
