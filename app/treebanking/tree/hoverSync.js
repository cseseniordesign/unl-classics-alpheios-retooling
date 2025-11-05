/**
 * --------------------------------------------------------------------------
 * FUNCTION: setupWordHoverSync
 * --------------------------------------------------------------------------
 * highlights corresponding words and nodes that are moused over.
 */
export function setupWordHoverSync() {
  const words = document.querySelectorAll(".token");
  const nodes = document.querySelectorAll(".node");
  //align ids between words and nodes 
  //whenever hovering over a word it highlights corresponding node
  words.forEach(word => {
    const id = word.dataset.wordId;
    word.addEventListener("mouseover", () => {
      word.classList.add("highlight");
      const node = document.querySelector(`.node[id="${id}"]`);
      if (node) node.classList.add("highlight");
    });
    //unhighlights when mouse is moved
    word.addEventListener("mouseleave", () => {
      word.classList.remove("highlight");
      const node = document.querySelector(`.node[id="${id}"]`);
      if (node) node.classList.remove("highlight");
    });
  });

  //whenever hovering over a node it highlights corresponding word
  nodes.forEach(node => {
    const id = node.id;
    node.addEventListener("mouseover", () => {
      node.classList.add("highlight");
      const word = document.querySelector(`.token[data-word-id="${id}"]`);
      if (word) word.classList.add("highlight");
    });
    //unhighlights when mouse is moved
    node.addEventListener("mouseleave", () => {
      node.classList.remove("highlight");
      const word = document.querySelector(`.token[data-word-id="${id}"]`);
      if (word) word.classList.remove("highlight");
    });
  });
}