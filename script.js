let rooms = [];
let student = null;
let requestSubmitted = false;

const API_URL = "https://hostelroomallocationsystem-production-cc01.up.railway.app/api";
const studentForm = document.getElementById("studentForm");
const formMessage = document.getElementById("formMessage");
const roomSection = document.getElementById("roomSection");
const roomType = document.getElementById("roomType");
const showRoomsButton = document.getElementById("showRoomsButton");
const roomTable = document.getElementById("roomTable");
const roomSelectionArea = document.getElementById("roomSelectionArea");
const selectedRoom = document.getElementById("selectedRoom");
const confirmRoomButton = document.getElementById("confirmRoomButton");

const allocationSection = document.getElementById("allocationSection");
const allocationMessage = document.getElementById("allocationMessage");
const allocationDetails = document.getElementById("allocationDetails");

const roomChangeButtonContainer =
    document.getElementById("roomChangeButtonContainer");
const roomChangeSection = document.getElementById("roomChangeSection");

function formatRoom(room) {
    const roomNumber = String(room.room_number);
    let floor = "Ground Floor";

    if (roomNumber.startsWith("F")) {
        floor = "1st Floor";
    } else if (roomNumber.startsWith("S")) {
        floor = "2nd Floor";
    } else if (roomNumber.startsWith("T")) {
        floor = "3rd Floor";
    }

    const typeMatch = String(room.room_type).match(/\d+/);

    return {
        id: room.id,
        roomNumber,
        floor,
        sharing: Number(typeMatch ? typeMatch[0] : room.capacity),
        capacity: Number(room.capacity),
        occupied: Number(room.occupied),
        monthlyFee: Number(room.monthly_fee),
        status: room.status
    };
}

async function loadRooms() {
    try {
        const response = await fetch(`${API_URL}/rooms`);
        const data = await response.json();

        if (!response.ok || !data.success || !Array.isArray(data.rooms)) {
            throw new Error(data.message || "Unable to load rooms.");
        }

        rooms = data.rooms.map(formatRoom);
        return true;
    } catch (error) {
        console.error("Room loading error:", error);
        formMessage.textContent =
            "Rooms could not load. Please check the backend server.";
        return false;
    }
}

// 1. Student registration
studentForm.addEventListener("submit", function (event) {
    event.preventDefault();

    if (requestSubmitted) {
        formMessage.textContent =
            "A room request has already been submitted for this session.";
        return;
    }

    student = {
        name: document.getElementById("studentName").value.trim(),
        id: document.getElementById("studentId").value.trim(),
        email: document.getElementById("studentEmail").value.trim(),
        department: document.getElementById("studentDepartment").value,
        year: document.getElementById("studentYear").value
    };

    if (
        !student.name ||
        !student.id ||
        !student.email ||
        !student.department ||
        !student.year
    ) {
        formMessage.textContent = "Please complete all student details.";
        return;
    }

    formMessage.textContent =
        `Registration successful! Welcome, ${student.name}.`;

    roomSection.style.display = "block";
    roomSection.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
});

// 2. Show available rooms
showRoomsButton.addEventListener("click", async function () {
    if (!student) {
        formMessage.textContent =
            "Please complete student registration first.";
        return;
    }

    if (requestSubmitted) {
        formMessage.textContent =
            "Your request has already been submitted.";
        return;
    }

    const sharing = Number(roomType.value);

    if (![2, 3, 4, 6].includes(sharing)) {
        formMessage.textContent = "Please select a room-sharing type.";
        return;
    }

    const loaded = await loadRooms();
    if (!loaded) return;

    const availableRooms = rooms.filter(room =>
        room.sharing === sharing &&
        room.occupied < room.capacity &&
        String(room.status).toLowerCase() !== "full"
    );

    roomTable.replaceChildren();
    roomSelectionArea.style.display = "none";

    if (availableRooms.length === 0) {
        roomTable.textContent =
            "No rooms are currently available for this sharing type.";
        return;
    }

    const table = document.createElement("table");
    const header = table.insertRow();

    [
        "Room Number",
        "Floor",
        "Sharing Type",
        "Available Beds",
        "Monthly Fee"
    ].forEach(title => {
        const th = document.createElement("th");
        th.textContent = title;
        header.appendChild(th);
    });

    availableRooms.forEach(room => {
        const row = table.insertRow();

        [
            room.roomNumber,
            room.floor,
            `${room.sharing} Sharing`,
            room.capacity - room.occupied,
            `₹${room.monthlyFee}`
        ].forEach(value => {
            const cell = row.insertCell();
            cell.textContent = value;
        });
    });

    roomTable.appendChild(table);

    selectedRoom.replaceChildren();

    const placeholder = document.createElement("option");
    placeholder.value = "";
    placeholder.textContent = "Select a room";
    selectedRoom.appendChild(placeholder);

    availableRooms.forEach(room => {
        const option = document.createElement("option");
        option.value = room.roomNumber;
        option.textContent =
            `${room.roomNumber} - ${room.floor} - ` +
            `${room.capacity - room.occupied} beds available`;

        selectedRoom.appendChild(option);
    });

    roomSelectionArea.style.display = "block";
});

// 3. Save request to MySQL and display confirmation details
confirmRoomButton.addEventListener("click", async function () {
    if (!student) {
        alert("Please register before selecting a room.");
        return;
    }

    if (requestSubmitted) {
        alert("Your room request has already been submitted.");
        return;
    }

    if (!selectedRoom.value) {
        alert("Please select a room.");
        return;
    }

    const loaded = await loadRooms();
    if (!loaded) return;

    const room = rooms.find(
        item => item.roomNumber === selectedRoom.value
    );

    if (
        !room ||
        room.occupied >= room.capacity ||
        String(room.status).toLowerCase() === "full"
    ) {
        alert("This room may be full. Please refresh the room list.");
        return;
    }

    confirmRoomButton.disabled = true;
    confirmRoomButton.textContent = "Submitting Request...";
    formMessage.textContent = "";

    try {
        const response = await fetch(`${API_URL}/student-requests`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                student_name: student.name,
                student_id: student.id,
                student_email: student.email,
                department: student.department,
                study_year: student.year,
                preferred_room_type: room.sharing,
                room_number: room.roomNumber
            })
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
            throw new Error(
                data.message || "Could not submit your room request."
            );
        }

        requestSubmitted = true;

        allocationMessage.textContent =
            "Your room request was submitted successfully. " +
            "Please wait for admin approval.";

        allocationDetails.replaceChildren();

        const details = [
            `Student Name: ${student.name}`,
            `Student ID: ${student.id}`,
            `Email: ${student.email}`,
            `Department: ${student.department}`,
            `Year: ${student.year}`,
            `Requested Room: ${room.roomNumber}`,
            `Floor: ${room.floor}`,
            `Room Type: ${room.sharing} Sharing`,
            `Monthly Fee: ₹${room.monthlyFee}`,
            `Request ID: ${data.requestId}`,
            "Request Status: Pending Admin Approval"
        ];

        details.forEach(detail => {
            const paragraph = document.createElement("p");
            paragraph.textContent = detail;
            allocationDetails.appendChild(paragraph);
        });

        allocationSection.style.display = "block";

        // Room change is kept hidden until the room is actually approved.
        if (roomChangeButtonContainer) {
            roomChangeButtonContainer.style.display = "none";
        }

        if (roomChangeSection) {
            roomChangeSection.style.display = "none";
        }

        confirmRoomButton.textContent = "Request Submitted";
        formMessage.textContent = data.message;

        allocationSection.scrollIntoView({
            behavior: "smooth",
            block: "start"
        });
    } catch (error) {
        console.error("Request submission error:", error);

        formMessage.textContent = error.message;
        confirmRoomButton.disabled = false;
        confirmRoomButton.textContent = "Confirm My Room";
    }
});

// Load rooms when the page opens
loadRooms();