class DynamicCard extends HTMLElement {
  constructor() {
    super();
    this.addTocartButton = this.querySelector('button[add-to-cart]');
    this.variantsData = this.getVariantsData();
    this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
    this.addEventListener('change', this.onVariantChange.bind(this));
    this.addTocartButton?.addEventListener('click', this.addTocart.bind(this));
    this.select = this.querySelector('select[select]');
    this.querySelector('.select-wrapper')?.addEventListener('click', this.handleClickSelect.bind(this));
  }

  connectedCallback() {
    this.onVariantChange();
  }

  handleClickSelect(event) {
    this.select?.click();
  }


  onVariantChange() {
    this.getCurrentSelectedOptions();
    this.getcurrentVariant();
    this.updateForm();
    this.toggleAddTocart()
  }

  toggleAddTocart() {
    if (this.currentVariant) {
      this.addTocartButton?.removeAttribute('disabled');
    } else {
      this.addTocartButton?.setAttribute('disabled', '');
    }
  }

  getCurrentSelectedOptions() {
    this.currentOptions = [this.querySelector('custom-dropdown'), ...this.querySelectorAll('input:checked')].map((option) => option.value);
  }

  getVariantsData() {
    if (this.variantsData) return this.variantsData;

    const jsonData = this.querySelector('[type="application/json"]');
    this.variantsData = jsonData ? JSON.parse(jsonData.textContent) : [];
    return this.variantsData;
  }

  getcurrentVariant() {
    this.currentVariant = this.variantsData.find((variant) =>
      variant.options.every((option, index) => this.currentOptions[index] === option)
    );
    console.log(this.currentVariant);
  }

  updateForm() {
    this.formData = {
      items: [],
    }


    if (this.currentVariant) {
      this.formData.items.push({ id: this.currentVariant.id, quantity: 1 });
    }
    //pass the bunlde product if the condition matches
    const bundleData = this.closest('product-grid')?.getBundleProductData();
    if (bundleData && this.currentOptions.every(option => bundleData?.bundleConditionOptions?.includes(option?.toLowerCase()))) {
      this.formData.items.push(
        {
          id: bundleData.bundleId,
          quantity: 1,
          properties: {
            '_bunlde': true
          }
        }
      );
    }
  }



  addTocart() {
    if (!this.formData.items.length) {
      console.error('No items to add to cart.');
      return;
    }

    this.formData.sections = this.getSectionsToRender().map((section) => section.id)
    this.sections_url = '/product'

    this.querySelector('.right-arrow')?.classList.add('hidden');
    this.querySelector('.loader-wrapper')?.classList.remove('hidden');
    this.addTocartButton?.setAttribute('disabled', '');

    fetch(`${window.Shopify.routes.root}cart/add.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(this.formData),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error(response.statusText);
        }
        return response.json();
      })
      .then(data => {
        this.closest('product-grid').querySelector('dialog')?.close();
        this.cart.renderContents(data);
        document.querySelector('cart-drawer')?.classList.remove('is-empty')
      })
      .catch((error) => console.error('Error:', error))
      .finally(() => {
        this.querySelector('.right-arrow')?.classList.remove('hidden');
        this.querySelector('.loader-wrapper')?.classList.add('hidden');
        this.addTocartButton?.removeAttribute('disabled');
      })
  }

  getSectionsToRender() {
    return [
      {
        id: 'cart-drawer',
        selector: '#CartDrawer',
      },
      {
        id: 'cart-icon-bubble',
      },
      {
        id: 'quick-view',
        selector: '.quick-card',
      }
    ];
  }
}

customElements.define('dynamic-card', DynamicCard);


class ProductGrid extends HTMLElement {
  constructor() {
    super();

    this.hotspotButton = this.querySelector('[hotspot-button]');
    this.dialog = this.querySelector('dialog');
    this.closeButton = this.dialog?.querySelector('button.close');
    this.closeButton?.addEventListener('click', () => this.dialog.close());
    this.addEventListener('click', this.handleClickEvent.bind(this));
  }

  getBundleProductData() {
    const condition = this.getAttribute('data-bundle-condition');
    if (!condition) return null;

    try {
      const bundleConditionOptions = condition.split(',').map(data => data.toLowerCase().trim());
      return {
        bundleConditionOptions,
        bundleId: this.getAttribute('data-bundle-id'),
      };
    } catch (error) {
      console.error('Invalid bundle condition:', error);
      return null;
    }
  }

  handleClickEvent(event) {
    const target = event.target;
    if (target.matches('[hotspot-button]')) {
      event.preventDefault();
      this.handleQuickView(event.target);
    }

    if (target.matches('dialog')) {
      this.dialog.close();
    }
  }
  //dynamically fetch the product data
  async handleQuickView(target) {
    const handle = target.getAttribute('data-product-handle');
    const variant = target.getAttribute('data-variant-id');
    const url = `/products/${handle}?variant=${variant}&view=quick-view`;

    try {
      const response = await fetch(url);
      const responseText = await response.text();
      const html = new DOMParser().parseFromString(responseText, 'text/html');

      this.dialog.querySelector('.quick-card').innerHTML = html.querySelector('dynamic-card').outerHTML;
      this.dialog.showModal();
    } catch (error) {
      console.error('Error fetching quick view:', error);
    }
  }
}

customElements.define('product-grid', ProductGrid);

//custom select tag
class CustomDropdown extends HTMLElement {
  constructor() {
    super();

    // Create a shadow DOM
    this.attachShadow({ mode: 'open' });
    this.value = '';

    // Get placeholder attribute from the element
    this.placeholder = this.getAttribute('placeholder') || 'Select';

    // Create the structure for the dropdown including CSS
    this.shadowRoot.innerHTML = `
      <style>
        .dropdown-wrapper {
          width: 100%;
          position: relative;
          font-family: Arial, sans-serif;
        }
        .dropdown-select {
          display: grid;
          grid-template-columns: calc(100% - 50px) 50px;
          padding-left:7px;
          max-height: 45px;
          height: 45px;
          border: 1px solid black;
          cursor: pointer;
          background-color: #fff;
          transition: background-color 0.3s;
        }
        .dropdown-select:hover {
          background-color: #f9f9f9;
        }
        .arrow {
          font-size: 18px;
          transition: transform 0.3s;
        }
        .options {
          display: none;
          list-style: none;
          padding: 0;
          margin: 0;
          border: 1px solid black;
          position: absolute;
          width: 100%;
          background-color: white;
          max-height: 100px;
          overflow-y: auto;
          z-index: 99;
          box-sizing: border-box;
        }
        .options::-webkit-scrollbar {
          display: none; /* Hide the scrollbar */
        }
        .options {
          scrollbar-width: none; /* Hide scrollbar for Firefox */
        }
        .options {
          -ms-overflow-style: none; /* Hide scrollbar for IE and Edge */
        }
        .options.active {
          display: block;
        }
        .options li {
          padding: 5px 10px;
          cursor: pointer;
          transition: all 0.2s ease;
          text-align: center;
          height:36px;
          box-sizing: border-box;
        }
        .options li:hover {
          background-color: black;
          color: white;
        }
        .placeholder {
          color: #999;
        }

        #selectedValue {
        align-self:center;
        }
        #selectedValue:not(.placeholder) {
        text-align:center;
        }

        .arrow {
            border-left: 1px solid black;
            padding: 0px 14px;
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100%;
        }
      </style>

      <div class="dropdown-wrapper" tabindex="0">
        <div class="dropdown-select">
          <span id="selectedValue" class="placeholder">${this.placeholder}</span>
          <span class="arrow">
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="10" viewBox="0 0 16 10" fill="none">
            <path d="M2 2L8 8L14 2" stroke="black" stroke-width="1.5" stroke-linecap="square"/>
          </svg>
          </span>
        </div>
        <ul class="options"></ul>
      </div>
    `;

    // Elements reference
    this.selectedValueElement = this.shadowRoot.getElementById('selectedValue');
    this.optionsList = this.shadowRoot.querySelector('.options');
    this.arrow = this.shadowRoot.querySelector('.arrow svg');

    // Event listener to toggle dropdown
    this.shadowRoot.querySelector('.dropdown-select .arrow').addEventListener('click', () => {
      this.toggleDropdown();
    });

    this.shadowRoot.addEventListener('focusout', this.closeDropdown.bind(this));

  }

  closeDropdown(event) {
    if (!this.contains(event.relatedTarget)) {
      this.closeDropdown()
    }
  }

  closeDropdown() {
    this.optionsList.classList.remove('active');
    this.arrow.style.transform = 'rotate(0deg)';
  }

  connectedCallback() {
    // Attach event listeners to the options from light DOM
    const options = this.querySelectorAll('li');
    options.forEach(option => {
      const li = document.createElement('li');
      li.textContent = option.textContent;
      li.setAttribute('data-value', option.getAttribute('data-value'));
      li.addEventListener('click', () => this.selectOption(option.textContent, option.getAttribute('data-value')));
      this.optionsList.appendChild(li);
    });
  }

  toggleDropdown() {
    this.optionsList.classList.toggle('active');
    this.arrow.style.transform = this.optionsList.classList.contains('active') ? 'rotate(180deg)' : 'rotate(0deg)';
  }

  selectOption(text, value) {
    this.selectedValueElement.textContent = text;
    this.selectedValueElement.classList.remove('placeholder');
    this.closeDropdown()
    this.value = value;

    // Dispatch custom event when an option is selected
    this.dispatchEvent(new CustomEvent('change', {
      detail: { value, text },
      bubbles: true,    // Allows the event to bubble up
      composed: true    // Enables event to pass through shadow DOM boundary
    }));
  }
}

// Register the custom element
customElements.define('custom-dropdown', CustomDropdown);
