// Loop through buttonmap and add event listeners
const showCover = (show = true) => { 
  const cover = document.getElementById('controlMappingCover');
  cover.style.display = show ? 'block' : 'none'; 
  cover.getElementsByTagName("span")[0].innerHTML = show;
};
const setKeyboard = (e) => {
  e.preventDefault();
  
  if(e.code == "Escape") {
    currentMap.innerHTML = "< Unset >"
  }
  else {
    currentMap.innerHTML = e.code;
  }
  document.removeEventListener('keydown', setKeyboard);
  showCover(false);
  return false;
}
let currentMap = null;



const buttonmap = document.getElementsByClassName("buttonmap");
for (let i = 0; i < buttonmap.length; i++) {
  buttonmap[i].addEventListener("click", function () {
    // Display cover
    currentMap = this;
    this.parentNode
    showCover(this.parentNode.getElementsByTagName("td")[0].innerHTML);
    document.addEventListener("keydown", setKeyboard);;

  });
}