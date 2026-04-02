
/**
 * --------------------------------------------------------------------------
 * FUNCTION: toggleTable
 * --------------------------------------------------------------------------
 * Toggles the comparison table when clicked/unclicked
 */
export function toggleTable() {
  let tableBG = document.querySelector("#table-bg"); 
  tableBG.style.display = "block";
  window.scrollTo(0,document.body.scrollHeight);
}