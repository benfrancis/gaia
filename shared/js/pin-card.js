/* exported ConfirmDialog */
/* global IconsHelper */
'use strict';

(function(exports) {

  function getTitle(data) {
    if (data.title) {
      return data.title;
    }
    if (data.linkedData.title) {
      return data.linkedData.title;
    }
    return data.url;
  }

  function getDescription(data) {
    if (data.content) {
      return data.content;
    }
    if (data.linkedData.description) {
      return data.linkedData.description;
    }
    return '';
  }

  function getBackgroundURL(data) {
    var img = data.linkedData.image || data.screenshot || data.tile;
    if (!img) {
      return null;
    } else {
      return (typeof img === 'string') ? img : URL.createObjectURL(img);
    }
  }

  function getBrightness(color) {
    var colorCodes = /rgb\((\d+), (\d+), (\d+)\)/.exec(color);
    if (!colorCodes || colorCodes.length === 0) {
      return;
    }
    var r = parseInt(colorCodes[1]);
    var g = parseInt(colorCodes[2]);
    var b = parseInt(colorCodes[3]);
    return Math.sqrt((r*r) * 0.241 + (g*g) * 0.691 + (b*b) * 0.068);
  }

  var PinCard = function(cardData) {
    cardData.linkedData = cardData.linkedData || {};
    var container = document.createElement('div');
    container.classList.add('pin-card');

    var background = document.createElement('div');
    background.className = 'background';
    background.style.backgroundColor = cardData.themeColor || 'white';
    var brightness =
      getBrightness(window.getComputedStyle(background).backgroundColor);
    if (brightness < 200) {
      container.classList.add('light');
    } else {
      container.classList.remove('light');
    }

    var header = document.createElement('header');
    var content = document.createElement('p');
    header.textContent = getTitle(cardData);
    content.textContent = getDescription(cardData);
    if (!content.textContent) {
      container.classList.add('no-content');
    }
    var icon = document.createElement('img');

    IconsHelper.getIcon(cardData.url, 32, cardData).then(iconBlob => {
      if (iconBlob) {
        var iconUrl = URL.createObjectURL(iconBlob.blob);
        container.dataset.iconUrl = iconUrl;
        icon.style.backgroundImage = 'url(' + iconUrl + ')';
      }

      container.appendChild(icon);
    });

    var backgroundURL = getBackgroundURL(cardData);
    if (backgroundURL) {
      container.style.backgroundImage = 'url(' + backgroundURL + ')';
    }

    if (cardData.url) {
      container.dataset.url = cardData.url;
    }

    container.appendChild(background);
    container.appendChild(header);
    container.appendChild(content);

    return {
      element: container
    };
  };

  exports.PinCard = PinCard;
}(window));
