const socket = io({ // Establish connection to the server
    reconnection: true, // Enable automatic reconnections
    reconnectionAttempts: Infinity, // Try to reconnect indefinitely
    reconnectionDelay: 1000, // Initial delay before attempting to reconnect
    reconnectionDelayMax: 5000 // Maximum delay between attempts
});
let currentPlayer; // To track whose turn it is
let playerColor; // To store the player's color
let diceResults = []; // Store current dice results
let rollsLeft = 3; // Maximum rolls allowed

document.getElementById('startGame').onclick = () => {
    const gameCode = generateGameCode();
    socket.emit('startGame', gameCode);
};

document.getElementById('joinGame').onclick = () => {
    const code = document.getElementById('gameCode').value;
    socket.emit('joinGame', code);
};

socket.on('gameStarted', (code) => {
    alert(`Game started with code: ${code}`);
});

socket.on('playerTurn', (player) => {
    if(currentPlayer !== player) {
        clearDices();
    }
    currentPlayer = player;
    console.log("currentPlayer", currentPlayer)
    if(currentPlayer === playerColor) {
        document.getElementById('currentPlayersTurn').innerText = `Its your turn!`;
        document.getElementById('rollDiceButton').style.display = 'block';
    } else {
        document.getElementById('currentPlayersTurn').innerText = `Waiting for your opponent to play!`;
        document.getElementById('rollDiceButton').style.display = 'none';
    }
    resetRolls(); // Reset rolls when it's the player's turn
});

socket.on('setupBoard', () => {
    setupBoard(); // Call setupBoard when notified
});

socket.on('playerColor', (data) => {
    playerColor = data.color; // Store player's color
    console.log(`You are playing as: ${playerColor}`);
    document.getElementById('playerName').innerText = `You are Player: ${playerColor}`
});

socket.on('opponentJoined', (data) => {
    console.log(`Your opponent is playing as: ${data.color}`);
});

socket.on('cellMarked', (board) => {
    updateCellDisplay(board); // Update the cell display based on the marked cell
});


socket.on('diceRolled', ({ results, rollsLeft }) => {
    console.log("server sends dices: ", results)
    displayDiceResults(results);
    updateRollsLeft(rollsLeft); // Update remaining rolls on UI
});

socket.on('finalizeTurn', () => {
    document.getElementById('rollDiceButton').style.display = 'none';
});

// Handle keeping dice
function keepDice(index) {
    console.log("keep dice:", index)
    const keptDice = document.querySelectorAll('.dice');
    keptDice[index].classList.toggle('kept'); // Toggle kept class for visual feedback
}

// Function to finalize the turn
function finalizeTurn(index) {
    if (currentPlayer === playerColor && rollsLeft >= 0) { // Ensure it's player's turn and no rolls left
        const selectedFieldIndex = parseInt(index); // Implement this function to get selected field index
        if (selectedFieldIndex !== null) { // Check if a field was selected
            socket.emit('markCell', { index: selectedFieldIndex, player: playerColor });
        } else {
            alert("Please select a field before finalizing your turn.");
        }
    } else {
        alert("It's not your turn or you still have rolls left!");
    }
}

document.getElementById('rollDiceButton').onclick = () => {
    if (currentPlayer === playerColor) { // Ensure it's player's turn
        console.log("Sending rollDiceRequest to server: ", playerColor)
        const keepArray = Array.from(document.querySelectorAll('.dice')).map(die => die.classList.contains('kept'));
        socket.emit('rollDiceRequest', keepArray); // Send which dice to keep to the server
    } else {
        alert("It's not your turn!");
    }
};

// Handle keeping dice visually
function keepDice(index) {
    const dieElement = document.querySelectorAll('.dice')[index];
    dieElement.classList.toggle('kept'); // Toggle kept class for visual feedback
}

// socket.on('diceRolled', ({ results, rollsLeft }) => {
//     displayDiceResults(results);
//     updateRollsLeft(rollsLeft); // Update remaining rolls on UI
// });

socket.on('unableToMark', ({ player }) => {
    // cant play
    document.getElementById('infoText').innerText = `You can't do any move! Other players will proceed.`
    document.getElementById('diceContainer').classList.toggle('background-red');

    setTimeout(function() {
         document.getElementById('infoText').innerText = ``; 
         document.getElementById('diceContainer').classList.toggle('background-red');
    }, 2500);
});

socket.on('winner', (winner) => {
    alert("Winner: ", winner);
});

// Reset rolls and UI for a new turn
function resetRolls() {
    rollsLeft = 3;
    updateRollsLeft(rollsLeft);
}


// Update the UI with remaining rolls
function updateRollsLeft(rollsLeft) {
    document.getElementById('remainingRolls').innerText = `Rolls left: ${rollsLeft}`;
}

function setupBoard() {
    const board = document.getElementById('board');
    board.innerHTML = '';

    // Define the board layout
    const boardLayout = [
        [4, 5, 'Four of a kind', 2, 3],
        [1, 'High Low', 'Straight', 'Cash', 6],
        ['Straight', 'Call', 'Kniffel', 'Full House', 'High Low'],
        [5, 'Full House', 'Cash', 'Four of a kind', 2],
        [6, 4, 'Call', 3, 1]
    ];

    // Create cells based on the board layout
    boardLayout.forEach((row, rowIndex) => {
        row.forEach((cellContent, colIndex) => {
            const cell = document.createElement('div');
            cell.className = 'cell';
            cell.innerText = cellContent; // Set cell content
            cell.dataset.index = rowIndex * 5 + colIndex; // Store index for easy access
            cell.onclick = () => markCell(cell.dataset.index); // Handle clicks to mark cells
            board.appendChild(cell);
        });
    });
}

function markCell(index) {
    if (currentPlayer === playerColor) { // Ensure it's the player's turn
        finalizeTurn(index); // Finalize turn after marking cell
    } else {
        alert("It's not your turn!");
    }
}

function rollDice() {
    return Array.from({ length: 5 }, () => Math.floor(Math.random() * 6) + 1);
}

function clearDices() {
    const diceContainer = document.getElementById('diceContainer');
    diceContainer.innerHTML = ''; // Clear previous results
}

function displayDiceResults(results) {
    clearDices();

    results.forEach((result, index) => {
        const dieElement = document.createElement('div');
        dieElement.className = 'dice';

        // Create the appropriate face based on the dice value
        switch (result) {
            case 1:
                dieElement.innerHTML = `
                    <div class="first-face">
                        <span class="pip"></span>
                    </div>`;
                break;
            case 2:
                dieElement.innerHTML = `
                    <div class="second-face">
                        <span class="pip"></span>
                        <span class="pip"></span>
                    </div>`;
                break;
            case 3:
                dieElement.innerHTML = `
                    <div class="third-face">
                        <span class="pip"></span>
                        <span class="pip"></span>
                        <span class="pip"></span>
                    </div>`;
                break;
            case 4:
                dieElement.innerHTML = `
                    <div class="fourth-face">
                        <div class="column">
                            <span class="pip"></span>
                            <span class="pip"></span>
                        </div>
                        <div class="column">
                            <span class="pip"></span>
                            <span class="pip"></span>
                        </div>
                    </div>`;
                break;
            case 5:
                dieElement.innerHTML = `
                    <div class="fifth-face">
                        <div class="column">
                            <span class="pip"></span>
                            <span class="pip"></span>
                        </div>
                        <div class="column">
                            <span class="pip"></span>
                        </div>
                        <div class="column">
                            <span class="pip"></span>
                            <span class="pip"></span>
                        </div>
                    </div>`;
                break;
            case 6:
                dieElement.innerHTML = `
                    <div class="sixth-face">
                        <div class="column">
                            <span class="pip"></span>
                            <span class="pip"></span>
                            <span class="pip"></span>
                        </div>
                        <div class="column">
                            <span class="pip"></span>
                            <span class="pip"></span>
                            <span class="pip"></span>
                        </div>
                    </div>`;
                break;
            default:
                dieElement.innerHTML = `<div>Invalid Die</div>`;
        }

        // Allow keeping dice on click
        dieElement.onclick = () => keepDice(index); // Pass current index
        diceContainer.appendChild(dieElement);
    });
}

function updateCellDisplay2(board) {
   const boardCells = document.querySelectorAll('.cell');
   const cellToUpdate = boardCells[index];
   if (player === 'white') {
       cellToUpdate.style.backgroundColor = 'lightgray'; // Example color for white player
   } else if (player === 'black') {
       cellToUpdate.style.backgroundColor = 'darkgray'; // Example color for black player
   }
}

function updateCellDisplay(board) {
    const boardCells = document.querySelectorAll('.cell'); // Select all cells in the board
    board.forEach((row, rowIndex) => {
        row.forEach((cell, colIndex) => {
            const index = rowIndex * 5 + colIndex; // Calculate the index based on row and column
            const cellToUpdate = boardCells[index]; // Get the corresponding cell element
            
            // Update the cell display based on its value
            if (cell === 'white') {
                cellToUpdate.style.backgroundColor = 'lightgray'; // Color for white player
            } else if (cell === 'black') {
                cellToUpdate.style.backgroundColor = 'darkgray'; // Color for black player
            } else {
                cellToUpdate.style.backgroundColor = ''; // Reset color for empty cells
            }
        });
    });
}

// Optional: Add any additional functions you need for game logic here

function generateGameCode() {
    return Math.random().toString(36).substring(2, 7).toUpperCase(); // Generate a random alphanumeric code
}


