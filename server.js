const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Store game states
let games = {};

app.use(express.static(path.join(__dirname, 'public')));

app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Function to initialize the board
function initializeBoardLayout() {
    return [
        [4, 5, 'Four of a kind', 2, 3],
        [1, 'High Low', 'Straight', 'Cash', 6],
        ['Straight', 'Bet', 'Kniffel', 'Full House', 'High Low'],
        [5, 'Full House', 'Cash', 'Four of a kind', 2],
        [6, 4, 'Bet', 3, 1]
    ];
}

function initializeBoard() {
    return [
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
        [null, null, null, null, null],
    ];
}

function rollDice(keep, lastDice) {
    return lastDice.map((value, index) => (keep[index] ? value : Math.floor(Math.random() * 6) + 1));
}

io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    socket.on('startGame', (code) => {
        games[code] = {
        	players: new Map(), // Initialize players as a Map
            turn: Math.random() < 0.5 ? 'white' : 'black',
            boardLayout: initializeBoardLayout(), // Initialize the board
            board: initializeBoard(),
            rollsLeft: 3,
            currentDice: [0,0,0,0,0],
            keptDice: [false, false, false, false, false] // Track which dice are kept
        };
        games[code].players.set(socket.id, 'white'); // First player gets white
        
        console.log(`Player ${socket.id} (white) created game ${code}`);

        socket.join(code);
        socket.emit('gameStarted', code);
        io.to(code).emit('playerTurn', games[code].turn);
        io.to(code).emit('setupBoard', { boardLayout: games[code].boardLayout, board: games[code].board } ); // Notify all players to setup the board
        socket.emit('playerColor', { color: 'white' }); // First player gets white
    });

    socket.on('joinGame', (code) => {
        if (games[code] && games[code].players.size < 2) {
        	const existingPlayerColor = games[code].players.entries().next().value
        	console.log("existingPlayerColor:",existingPlayerColor)
        	const joiningPlayerColor = existingPlayerColor === 'black'? 'white' : 'black'
            games[code].players.set(socket.id, joiningPlayerColor); // Second player gets black

            socket.join(code);
            io.to(code).emit('setupBoard', { boardLayout: games[code].boardLayout, board: games[code].board }); // Notify all players to setup the board
            socket.emit('playerColor', { color: joiningPlayerColor }); // Second player gets black

         	console.log(`Player ${socket.id} (${joiningPlayerColor}) joined game ${code}`);

            io.to(code).emit('playerTurn', games[code].turn);

            // Notify first player about the new opponent
            const firstPlayerSocketId = games[code].players.keys[0]; //
            io.to(firstPlayerSocketId).emit('opponentJoined', { color: 'black' });
            io.to(code).emit('cellMarked', games[code].board);
        } else {
        	console.log('Game not found or already full: ', code);
        	if(games[code]) {
        		console.log(games[code].players);
        	}
            socket.emit('error', 'Game not found or already full');
        }
    });


    // Handle rolling dice
    socket.on('rollDiceRequest', ({ keep, bet }) => {
        //const currentGameCode = Object.keys(games).find(code => games[code].players.includes(socket.id));
        const currentGameCode = findGameCode(socket.id);
        console.log("rollDiceRequest GameCode: ", currentGameCode);

        if (currentGameCode && games[currentGameCode].rollsLeft > 0) {
        	console.log("rollDiceRequest called");
            const game = games[currentGameCode];
            game.keptDice = keep; // Update which dice are kept
            lastDice = game.currentDice;
            game.currentDice = rollDice(game.keptDice, lastDice); // Roll the dice based on kept status
            game.rollsLeft--; // Decrease rolls left

            // Emit rolled dice results to both players
            io.to(currentGameCode).emit('diceRolled', { results: game.currentDice, rollsLeft: game.rollsLeft });
            
            if (game.rollsLeft === 0) {
                io.to(currentGameCode).emit('finalizeTurn'); // Notify that turn is finalizing
                try {
                	const player = socket.id === game.players[0] ? 'white' : 'black'
                	const dices = game.currentDice
                	const boardLayout = game.boardLayout;
					const board = game.board;
        			if(!checkMovePossibleOnFinalTurn(player, dices, boardLayout, board)){
        				console.log("no valid move found for player: ", player);
        				io.to(currentGameCode).emit('unableToMark', { player: player }); // Notify that player cant do any mark
        				resetGameState(currentGameCode);
        				nextPlayer = game.turn === 'white' ? 'black' : 'white'
                		game.turn = nextPlayer
            		    setTimeout(function() {
							io.to(currentGameCode).emit('playerTurn', game.turn);
						}, 2500);
                		
        			} else {

        			}
        		} catch (error) {
	                console.error(error.message); // Log invalid moves for debugging
	                socket.emit('errorMessage', error.message); // Send error message to client
	                io.to(currentGameCode).emit('cellMarked', board);
            	}
            }
        } else {
        	console.log("rollDiceRequest to numbis game.");
        }
    });

    function findGameCode(socketId) {
    	const currentGameCode = Object.keys(games).find(code => games[code].players.has(socketId));
    	if(currentGameCode){
    		return currentGameCode
    	} 
    	return null
    }

    // Handle marking a cell on the board
    socket.on('markCell', ({ index, player }) => {
    	const currentGameCode = findGameCode(socket.id)
        console.log(`markCell: ${player} trying to mark cell ${index}`);

        if (currentGameCode) {
            // Logic to mark cell on the board and validate move
            const game = games[currentGameCode];

            const board = game.board;
            const boardLayout = game.boardLayout;
            const dices = game.currentDice;
            const rollsLeft = game.rollsLeft
            const player = game.players.get(socket.id)

            // Example logic: mark cell based on index (you may want to adjust this)
            const rowIndex = Math.floor(index / 5);
            const colIndex = index % 5;

        	try {
        		checkValidMove(player, dices, boardLayout, rowIndex, colIndex, rollsLeft);
        		console.log(`checkValidMove is okay with the move.`);
        		board[rowIndex][colIndex] = player; // Mark cell with player identifier
                io.to(currentGameCode).emit('cellMarked', board);
                nextPlayer = game.turn === 'white' ? 'black' : 'white'
                game.turn = nextPlayer
                resetGameState(currentGameCode);
                io.to(currentGameCode).emit('playerTurn', game.turn);
                console.log(`${player} marked cell ${index}. Now it is ${game.turn}`);
            } catch (error) {
                console.error(error.message); // Log invalid moves for debugging
                socket.emit('errorMessage', error.message); // Send error message to client
                io.to(currentGameCode).emit('cellMarked', board);
            }

            // Check for winner or valid moves here...
            const winner = checkWinner(board);
            if(winner!==null){
            	console.log("Winner: ",winner)
            	io.to(currentGameCode).emit('winner', winner);
            }
        }
    });

    function checkValidMove(player, dices, boardLayout, rowIndex, colIndex, rollsLeft) {
	    const cellValue = boardLayout[rowIndex][colIndex];
	    if (dices[0] === null) throw new Error("Invalid move: Marking before rolling the dices is not valid.");

	    switch (cellValue) {
	        case 1: // Number field (1)
	        case 2: // Number field (2)
	        case 3: // Number field (3)
	        case 4: // Number field (4)
	        case 5: // Number field (5)
	        case 6: // Number field (6)
	        	checkValidMoveNumbers(cellValue, dices);
	            break;
	        
	        case 'Four of a kind':
	        	checkValidMoveFourOfAKind(dices);
	            break;

	        case 'High Low':
	        	checkValidMoveHighLow(dices);
	            break;

	        case 'Straight':
	        	checkValidMoveStraight(dices);
	            break;

	        case 'Kniffel':
	        	checkValidMoveKniffel(dices);
	            break;

	        case 'Full House':
	        	checkValidMoveFullHouse(dices);
	            break;

	        case 'Cash':
	            if (rollsLeft !== 2) throw new Error("Invalid move: Cash can only be used on the with roll.");
	            // If any other rule is valid for cash field
	            var valid = false;
	            try { checkValidMoveFullHouse(dices); valid = true; } catch(err) {}
	            try { checkValidMoveKniffel(dices); valid = true; } catch(err) {}
	            try { checkValidMoveStraight(dices); valid = true; } catch(err) {}
	            try { checkValidMoveHighLow(dices); valid = true; } catch(err) {}
	            try { checkValidMoveFourOfAKind(dices); valid = true; } catch(err) {}
	            if(!valid) throw new Error("Invalid move: Cash can only be used with when one of the other rules is matching.");
	            break;

	        default:
	            throw new Error("Invalid move: Unknown cell type");
	        return;
	    }
	}

	function checkValidMoveNumbers(cellValue, dices){
        const numberToCheck = cellValue;
        const count = dices.filter(dice => dice === numberToCheck).length;
        if (count < 3) throw new Error("Invalid move: Not enough dice showing " + numberToCheck);
	}

	function checkValidMoveFourOfAKind(dices){
        const groupedByValue = {};
        dices.forEach(dice => groupedByValue[dice] = (groupedByValue[dice] || 0) + 1);
        const fourOfAKindCount = Object.values(groupedByValue).some(count => count >= 4);
        if (!fourOfAKindCount) throw new Error("Invalid move: Not four of a kind");
	}

	function checkValidMoveHighLow(dices){
        const sum = dices.reduce((accumulatedSum, die) => accumulatedSum + die, 0);
        if (!(sum < 9 || sum > 26)) throw new Error("Invalid move: High Low condition not met");
	}

	function checkValidMoveStraight(dices) {
        const sortedDices = [...new Set(dices)].sort((a,b) => a - b);
        const isStraight1 = JSON.stringify(sortedDices) === JSON.stringify([1,2,3,4,5]);
        const isStraight2 = JSON.stringify(sortedDices) === JSON.stringify([2,3,4,5,6]);
        if (!(isStraight1 || isStraight2)) throw new Error("Invalid move: Not a straight");
	}

	function checkValidMoveKniffel(dices) {
        const allSame = dices.every(die => die === dices[0]);
        if (!allSame) throw new Error("Invalid move: Not Kniffel");
	}

	function checkValidMoveFullHouse(dices) {
        const counts = {};
        dices.forEach(die => counts[die] = (counts[die] || 0) + 1);
        const valuesCount = Object.values(counts);
        if (!(valuesCount.includes(3) && valuesCount.includes(2))) throw new Error("Invalid move: Not a Full House");
	}

	function checkMovePossibleOnFinalTurn(player, dices, boardLayout, board) {
		var possibleValidMoves = 0;
	    board.forEach((row, rowIndex) => {
	        row.forEach((cell, colIndex) => {
	        	if(cell === null){
	        		try {
		        		checkValidMove(player, dices, boardLayout, rowIndex, colIndex, 0);
		        		console.log(`checkValidMove found for ${player}.`);
		        		possibleValidMoves++;
		        	} catch(error) {}
	        	} else {
	        		// special "stealing" rule check
	        	}
	        })
        })
        return possibleValidMoves > 0;
	}

    function resetGameState(gameCode) {
        const game = games[gameCode];
        game.rollsLeft = 3; // Reset rolls for next player
        game.currentDice = [null, null, null, null, null]; // Reset current dice
        game.keptDice.fill(false); // Reset kept dice status
    }

    function checkWinner(board) {
	    const size = board.length; // Assuming square board (5x5)
	    
	    // Check horizontal and vertical lines
	    for (let i = 0; i < size; i++) {
	        for (let j = 0; j < size - 4; j++) {
	            // Check horizontal
	            if (board[i][j] && board[i][j] === board[i][j + 1] && board[i][j] === board[i][j + 2] &&
	                board[i][j] === board[i][j + 3] && board[i][j] === board[i][j + 4]) {
	                return board[i][j]; // Return the winner ('white' or 'black')
	            }
	            // Check vertical
	            if (board[j][i] && board[j][i] === board[j + 1][i] && board[j][i] === board[j + 2][i] &&
	                board[j][i] === board[j + 3][i] && board[j][i] === board[j + 4][i]) {
	                return board[j][i]; // Return the winner ('white' or 'black')
	            }
	        }
	    }

	    // Check diagonals
	    for (let i = 0; i < size - 4; i++) {
	        for (let j = 0; j < size - 4; j++) {
	            // Check diagonal from top-left to bottom-right
	            if (board[i][j] && board[i][j] === board[i + 1][j + 1] && 
	                board[i][j] === board[i + 2][j + 2] && 
	                board[i][j] === board[i + 3][j + 3] && 
	                board[i][j] === board[i + 4][j + 4]) {
	                return board[i][j]; // Return the winner ('white' or 'black')
	            }
	            // Check diagonal from bottom-left to top-right
	            if (board[i + 4][j] && board[i + 4][j] === board[i + 3][j + 1] &&
	                board[i + 4][j] === board[i + 2][j + 2] &&
	                board[i + 4][j] === board[i + 1][j + 3] &&
	                board[i + 4][j] === board[i][j + 4]) {
	                return board[i + 4][j]; // Return the winner ('white' or 'black')
	            }
	        }
	    }

	    return null; // No winner found
	}


    socket.on('disconnect', () => {
        console.log('User disconnected:', socket.id);
        const currentGameCode = findGameCode(socket.id)
        if (currentGameCode) {
			const game = games[currentGameCode];
			 console.log("players before cleanup: ", game.players);

            game.players.delete(socket.id); // Remove player from players map
            
            console.log(`Player ${socket.id} removed from game ${currentGameCode}`);
            console.log("players after cleanup: ", game.players);
            
            if (games[currentGameCode].players.size === 0) { 
                delete games[currentGameCode]; // Clean up if no players left in the game
                console.log(`Game ${currentGameCode} deleted due to no players.`);
            }
        }
    });

});


const PORT = 3000;
server.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
});
