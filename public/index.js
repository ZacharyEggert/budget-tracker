let transactions = [];
let myChart;


/** ------------------------ */
const populateIndexedDB = (tsats) => {


  const request = window.indexedDB.open("budgetTransactions", 1);

  // Create schema
  request.onupgradeneeded = event => {
    console.log('installing schema to indexedDB');
    const db = event.target.result;
    
    const budgetTransactionsStore = db.createObjectStore("budgetTransactions", {keyPath: "ID", autoIncrement: true});
    budgetTransactionsStore.createIndex("name", "name"); 
    budgetTransactionsStore.createIndex("value", "value"); 
    budgetTransactionsStore.createIndex("date", "date");


  }

  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction(["budgetTransactions"], "readwrite");
    const budgetTransactionsStore = transaction.objectStore("budgetTransactions");

    const allReq = budgetTransactionsStore.getAll();

    let ctsats = [];

    allReq.onsuccess = function(e) {                    
      ctsats = [...allReq.result]
      console.log({ctsats});

      const clientDate = new Date(ctsats[ctsats.length-1]?.date || new Date(0));
      const serverDate = new Date(tsats[tsats.length - 1]?.date);

      console.log({ctsats, tsats, clientDate, serverDate});

      if(serverDate === clientDate){
        console.log('server connected and up to date')
        return;}
      
      

      if(serverDate > clientDate){
        console.log('client out of date')
        const tsats_red = [];
        tsats.forEach(tsat => {
          if (new Date(tsat.date) > new Date(clientDate)){
            tsats_red.push(tsat);
          }
        })
        console.log('adding objects', tsats_red);




        tsats_red.forEach(({name, value, date}) => {
          budgetTransactionsStore.add({name, value, date});
        })

        return;
      }

      if(serverDate < clientDate){
        console.log('server out of date')
        const ctsats_red = [];
        ctsats.forEach(ctsat => {
          if (new Date(ctsat.date) > new Date(serverDate)){
            ctsats_red.push(ctsat);
          }
        })
        console.log('sending objects to server', ctsats_red)

        fetch('/api/transaction/bulk', {
          headers: {'content-type': 'application/json'},
          body: JSON.stringify(ctsats_red),
          method: 'post'
        })
        .then(result => {
          console.log('successfully posted data');
        })
        .then(result => {
          window.location.reload();
        })
        .catch(err => {
          console.error(err);
        })

        return;
      }
    };
  };
}



/** ------------------------ */
const saveRecord = (tsat) => {
  const request = window.indexedDB.open("budgetTransactions", 1);

  // Create schema
  request.onupgradeneeded = event => {
    console.log('installing schema to indexedDB');
    const db = event.target.result;
    
    const budgetTransactionsStore = db.createObjectStore("budgetTransactions", {keyPath: "ID"});
    budgetTransactionsStore.autoIncrement = true;
    budgetTransactionsStore.createIndex("name", "name"); 
    budgetTransactionsStore.createIndex("value", "value"); 
    budgetTransactionsStore.createIndex("date", "date");


  }

  request.onsuccess = () => {
    const db = request.result;
    const transaction = db.transaction(["budgetTransactions"], "readwrite");
    const budgetTransactionsStore = transaction.objectStore("budgetTransactions");

    console.log('adding object', tsat);
    const transReq = budgetTransactionsStore.add(tsat);
    transReq.onsuccess = () => {
      console.log('object added')
    }

  };
}

fetch("/api/transaction")
  .then(response => {
    return response.json();
  })
  .then(data => {
    // save db data on global variable
    transactions = data;

    populateTotal();
    populateTable();
    populateChart();
    populateIndexedDB(transactions);
  })
  .catch(err => {

  });

function populateTotal() {
  // reduce transaction amounts to a single total value
  let total = transactions.reduce((total, t) => {
    return total + parseInt(t.value);
  }, 0);

  let totalEl = document.querySelector("#total");
  totalEl.textContent = total;
}

function populateTable() {
  let tbody = document.querySelector("#tbody");
  tbody.innerHTML = "";

  transactions.forEach(transaction => {
    // create and populate a table row
    let tr = document.createElement("tr");
    tr.innerHTML = `
      <td>${transaction.name}</td>
      <td>${transaction.value}</td>
    `;

    tbody.appendChild(tr);
  });
}

function populateChart() {
  // copy array and reverse it
  let reversed = transactions.slice().reverse();
  let sum = 0;

  // create date labels for chart
  let labels = reversed.map(t => {
    let date = new Date(t.date);
    return `${date.getMonth() + 1}/${date.getDate()}/${date.getFullYear()}`;
  });

  // create incremental values for chart
  let data = reversed.map(t => {
    sum += parseInt(t.value);
    return sum;
  });

  // remove old chart if it exists
  if (myChart) {
    myChart.destroy();
  }

  let ctx = document.getElementById("myChart").getContext("2d");

  myChart = new Chart(ctx, {
    type: 'line',
      data: {
        labels,
        datasets: [{
            label: "Total Over Time",
            fill: true,
            backgroundColor: "#6666ff",
            data
        }]
    }
  });
}

function sendTransaction(isAdding) {
  let nameEl = document.querySelector("#t-name");
  let amountEl = document.querySelector("#t-amount");
  let errorEl = document.querySelector(".form .error");

  // validate form
  if (nameEl.value === "" || amountEl.value === "") {
    errorEl.textContent = "Missing Information";
    return;
  }
  else {
    errorEl.textContent = "";
  }

  // create record
  let transaction = {
    name: nameEl.value,
    value: amountEl.value,
    date: new Date().toISOString()
  };

  // if subtracting funds, convert amount to negative number
  if (!isAdding) {
    transaction.value *= -1;
  }

  // add to beginning of current array of data
  transactions.unshift(transaction);

  // re-run logic to populate ui with new record
  populateChart();
  populateTable();
  populateTotal();
  
  // also send to server
  fetch("/api/transaction", {
    method: "POST",
    body: JSON.stringify(transaction),
    headers: {
      Accept: "application/json, text/plain, */*",
      "Content-Type": "application/json"
    }
  })
  .then(response => {    
    return response.json();
  })
  .then(data => {
    if (data.errors) {
      errorEl.textContent = "Missing Information";
    }
    else {
      // clear form
      nameEl.value = "";
      amountEl.value = "";
    }
  })
  .catch(err => {
    // fetch failed, so save in indexed db
    saveRecord(transaction);

    // clear form
    nameEl.value = "";
    amountEl.value = "";
  });
}

document.querySelector("#add-btn").onclick = function() {
  sendTransaction(true);
};

document.querySelector("#sub-btn").onclick = function() {
  sendTransaction(false);
};
