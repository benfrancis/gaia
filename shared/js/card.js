/* exported ConfirmDialog */
'use strict';
(function(exports) {
  var Card = function(cardData) {
    var container = document.createElement('div');
    container.classList.add('card');

    var header = document.createElement('header');
    var content = document.createElement('p');
    header.textContent = cardData.title ? cardData.title : '';
    content.textContent = cardData.content ? cardData.content : '';

    if (cardData.icons && Object.keys(cardData.icons).length) {
      var icon = document.createElement('img');
      icon.src = cardData.icons ? Object.keys(cardData.icons)[0] : '';
      container.appendChild(icon);
    }

    if (cardData.screenshot || cardData.tile) {
      var img = cardData.screenshot || cardData.tile;
      var imgUrl = (typeof img === 'string') ? img : URL.createObjectURL(img);
      container.style.backgroundImage = 'url(' + imgUrl + ')';
    }

    if (cardData.url) {
      container.dataset.url = cardData.url;
    }

    container.appendChild(header);
    container.appendChild(content);

    return {
      element: container
    };
  };

  exports.Card = Card;
}(window));
