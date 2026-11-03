
 🍽️ FoodConnect

 A Food Donation and Redistribution Platform

FoodConnect is a web-based platform designed to reduce food wastage by connecting restaurants that have surplus food with NGOs and shelters that need food.

The platform also connects delivery agents to help transport donated food from restaurants to NGOs, making food redistribution easier and more efficient.

🎯 Project Objective

The main objective of FoodConnect is to:
- Reduce food wastage.
- Connect restaurants with NGOs and shelters.
- Facilitate food donation and redistribution.
- Help delivery agents manage food pickups and deliveries.
- Support efficient food distribution through location-based matching.

- ✨ Features

👤 User Registration and Login
- Registration and login for different user roles.
- Supports restaurants, NGOs/shelters, and delivery agents.

🍴 Restaurant Dashboard
- Post surplus food donations.
- Manage food donation details.
- Track donation status.

🏠 NGO Dashboard
- View available food donations.
- Accept food donations.
- Track donation and delivery status.

🚚 Delivery Agent Dashboard
- View assigned delivery requests.
- Manage food pickups and deliveries.
- Update delivery status.

 🗺️ Live Map
- Display donation-related locations.
- Help users identify nearby food donations.
- Support location-based food matching.

🛠️ Technologies Used

| Technology | Purpose |
|---|---|
| React.js | Frontend development |
| JavaScript | Application logic |
| Node.js | Backend runtime |
| Express.js | Backend API development |
| SQLite | Database management |
| HTML & CSS | Structure and styling |
| Leaflet | Interactive maps |
| OpenStreetMap | Map data |

## 📁 Project Structure

```text
FoodConnectReact/
├── public/             # Public assets
├── scripts/            # Utility scripts
├── server/             # Backend-related files
├── src/                # React frontend
│   ├── components/     # Reusable components
│   ├── context/        # Shared application state
│   ├── pages/          # Application pages
│   └── utils/          # Utility functions
├── server.js           # Backend server
├── package.json        # Project dependencies
├── package-lock.json   # Dependency lock file
└── README.md           # Project documentation
```

 ⚙️ Installation and Setup

Prerequisites

Make sure the following are installed:

- Node.js
- npm
- Git

Step 1: Clone the Repository

```bash
git clone https://github.com/YOUR-USERNAME/FoodConnectReact.git
```

Step 2: Navigate to the Project Folder

```bash
cd FoodConnectReact
```

Step 3: Install Dependencies

```bash
npm install
```

Step 4: Start the Application

```bash
npm start
```

This starts the frontend and backend development servers.

Step 5: Open in Browser

Visit:

http://localhost:3000

🗄️ Database

FoodConnect uses SQLite to store application data, including:

- User information
- Food donation details
- NGO responses
- Delivery assignments
- Notifications

The database is managed by the backend server.

🔄 How It Works

1. Restaurants register and log in to the platform.
2. Restaurants post details about surplus food.
3. NGOs view and accept available food donations.
4. Delivery agents collect food from restaurants.
5. Food is delivered to NGOs or shelters.
6. Donation and delivery statuses are updated.

🌱 Future Enhancements

- Online deployment.
- Email and SMS notifications.
- Improved food matching based on distance.
- Real-time delivery tracking.
- Enhanced analytics for food donation management.

👩‍💻 Developed By

Aarchi Bhanushali

📌 Project Purpose

FoodConnect aims to create a sustainable food donation ecosystem by connecting food donors, NGOs, and delivery agents through a single platform.

Together, we can reduce food waste and help feed people in need.
