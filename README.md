# Multiplayer Asteroids with Node.js and p5.js

Welcome to the GitHub repository for **Multiplayer Asteroids**, a modern take on the classic arcade game built with Node.js and p5.js.

This project combines the simplicity of p5.js with the power of Node.js to create a real-time multiplayer gaming experience that can be played across modern browsers and devices.

## Features

- **Real-time Multiplayer Gameplay**  
  Players can join the game from different devices and compete or cooperate in real time.

- **Node.js Backend**  
  Uses Node.js to handle player connections, game logic, and state synchronisation.

- **p5.js Graphics**  
  Uses p5.js for dynamic, responsive game visuals.

- **Responsive Design**  
  Adapts to different screen sizes for desktop, tablet, and phone gameplay.

- **Cross-Browser Compatibility**  
  Designed to work consistently across modern browsers and phones.

## Getting Started

Follow the steps below to get a local copy of the project running.

## Prerequisites

You will need:

- Git
- Node.js
- npm

### Ubuntu Prerequisites Example

On Ubuntu, you can install the required packages with:

```bash
sudo apt update
sudo apt install -y git curl ca-certificates

curl -fsSL https://deb.nodesource.com/setup_lts.x | sudo -E bash -
sudo apt install -y nodejs

node --version
npm --version
git --version
```

This installs the current Node.js LTS release from NodeSource, along with npm and Git.

## Installation

1. Clone the repository:

```bash
git clone https://github.com/paulduttonpad/AsteroidsJS.git
```

2. Navigate to the project directory:

```bash
cd AsteroidsJS
```

3. Install the npm dependencies:

```bash
npm install
```

4. Start the server:

```bash
npm start
```

## Playing the Game

After starting the server, open your web browser and go to:

```text
http://localhost:10000
```

Use the arrow keys to move your spaceship and the spacebar to shoot asteroids.

## Development Notes

The application is expected to be started using:

```bash
npm start
```

If you are running the game on a remote machine or VM, replace `localhost` with the hostname or IP address of that machine, for example:

```text
http://192.168.1.50:10000
```

Make sure port `10000` is open and accessible if connecting from another device.

## Contact

Paul Dutton - pauldutton@pad-digital.co.uk

Project Link: https://github.com/paulduttonpad/AsteroidsJS
