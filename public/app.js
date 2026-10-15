// Tab Switching
function switchTab(tab) {
  const submitTab = document.getElementById('tab-submit');
  const trackTab = document.getElementById('tab-track');
  const submitSec = document.getElementById('section-submit');
  const trackSec = document.getElementById('section-track');

  if (tab === 'submit') {
    submitTab.className = 'px-6 py-3 font-semibold text-blue-600 border-b-2 border-blue-600';
    trackTab.className = 'px-6 py-3 font-semibold text-gray-500 hover:text-gray-700';
    submitSec.classList.remove('hidden');
    trackSec.classList.add('hidden');
  } else {
    trackTab.className = 'px-6 py-3 font-semibold text-blue-600 border-b-2 border-blue-600';
    submitTab.className = 'px-6 py-3 font-semibold text-gray-500 hover:text-gray-700';
    trackSec.classList.remove('hidden');
    submitSec.classList.add('hidden');
  }
}

// Handle Ticket Submission
const ticketForm = document.getElementById('ticketForm');
if (ticketForm) {
  ticketForm.addEventListener('submit', async (e) => {
    e.preventDefault();

    const payload = {
      title: document.getElementById('title').value,
      category: document.getElementById('category').value,
      priority: document.getElementById('priority').value,
      description: document.getElementById('description').value,
      requester_name: document.getElementById('requester_name').value,
      requester_email: document.getElementById('requester_email').value,
    };

    try {
      const response = await fetch('/api/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await response.json();
      const alertBox = document.getElementById('alert-message');

      if (response.ok) {
        alertBox.className = 'mb-6 p-4 rounded-lg text-sm font-medium bg-green-100 text-green-800 border border-green-200';
        alertBox.innerHTML = `<strong>Success!</strong> Your request has been logged under ID: <span class="font-bold underline">${data.ticketNumber}</span>`;
        alertBox.classList.remove('hidden');
        ticketForm.reset();
      } else {
        throw new Error(data.error || 'Failed to submit ticket');
      }
    } catch (err) {
      const alertBox = document.getElementById('alert-message');
      alertBox.className = 'mb-6 p-4 rounded-lg text-sm font-medium bg-red-100 text-red-800 border border-red-200';
      alertBox.textContent = err.message;
      alertBox.classList.remove('hidden');
    }
  });
}

// User Ticket Search
async function searchTickets() {
  const query = document.getElementById('searchQuery').value;
  const resultsContainer = document.getElementById('searchResults');

  if (!query.trim()) {
    resultsContainer.innerHTML = '<p class="text-red-500 text-sm">Please enter a ticket ID or email address.</p>';
    return;
  }

  try {
    const res = await fetch(`/api/tickets/search?query=${encodeURIComponent(query)}`);
    const tickets = await res.json();

    if (tickets.length === 0) {
      resultsContainer.innerHTML = '<p class="text-gray-500 text-sm">No tickets found matching your search.</p>';
      return;
    }

    resultsContainer.innerHTML = tickets.map(t => `
      <div class="border rounded-lg p-5 bg-gray-50 space-y-2">
        <div class="flex justify-between items-center">
          <span class="text-sm font-bold text-blue-600">${t.ticket_number}</span>
          <span class="px-2.5 py-1 text-xs rounded-full font-semibold ${getStatusBadgeClass(t.status)}">${t.status}</span>
        </div>
        <h3 class="font-bold text-gray-900">${t.title}</h3>
        <p class="text-sm text-gray-600">${t.description}</p>
        <div class="text-xs text-gray-400 flex gap-4 pt-2">
          <span>Category: ${t.category}</span>
          <span>Priority: ${t.priority}</span>
          <span>Submitted: ${new Date(t.created_at).toLocaleDateString()}</span>
        </div>
      </div>
    `).join('');
  } catch (err) {
    resultsContainer.innerHTML = '<p class="text-red-500 text-sm">Error loading ticket status.</p>';
  }
}

// Load Admin Dashboard Tickets
async function loadAdminTickets() {
  const status = document.getElementById('filterStatus')?.value || '';
  const category = document.getElementById('filterCategory')?.value || '';
  const tbody = document.getElementById('adminTicketList');

  try {
    const res = await fetch(`/api/tickets?status=${encodeURIComponent(status)}&category=${encodeURIComponent(category)}`);
    const tickets = await res.json();

    updateStats(tickets);

    if (tickets.length === 0) {
      tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-gray-500">No tickets found.</td></tr>';
      return;
    }

    tbody.innerHTML = tickets.map(t => `
      <tr class="hover:bg-gray-50">
        <td class="py-3 px-4 font-bold text-blue-600">${t.ticket_number}</td>
        <td class="py-3 px-4 font-medium text-gray-900">${t.title}</td>
        <td class="py-3 px-4 text-xs">
          <div class="font-semibold text-gray-800">${t.requester_name}</div>
          <div class="text-gray-500">${t.requester_email}</div>
        </td>
        <td class="py-3 px-4">${t.category}</td>
        <td class="py-3 px-4">
          <span class="px-2 py-0.5 text-xs rounded font-semibold ${getPriorityBadgeClass(t.priority)}">${t.priority}</span>
        </td>
        <td class="py-3 px-4">
          <span class="px-2.5 py-1 text-xs rounded-full font-semibold ${getStatusBadgeClass(t.status)}">${t.status}</span>
        </td>
        <td class="py-3 px-4 text-xs text-gray-500">${new Date(t.created_at).toLocaleDateString()}</td>
        <td class="py-3 px-4">
          <select onchange="updateTicketStatus(${t.id}, this.value)" class="text-xs border rounded p-1 bg-white">
            <option value="Open" ${t.status === 'Open' ? 'selected' : ''}>Open</option>
            <option value="In Progress" ${t.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
            <option value="Resolved" ${t.status === 'Resolved' ? 'selected' : ''}>Resolved</option>
            <option value="Closed" ${t.status === 'Closed' ? 'selected' : ''}>Closed</option>
          </select>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    if (tbody) tbody.innerHTML = '<tr><td colspan="8" class="text-center py-6 text-red-500">Error loading tickets.</td></tr>';
  }
}

// Update Status from Admin Dashboard
async function updateTicketStatus(id, newStatus) {
  try {
    await fetch(`/api/tickets/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: newStatus })
    });
    loadAdminTickets();
  } catch (err) {
    alert('Failed to update ticket status');
  }
}

function updateStats(tickets) {
  if (!document.getElementById('stat-total')) return;
  document.getElementById('stat-total').textContent = tickets.length;
  document.getElementById('stat-open').textContent = tickets.filter(t => t.status === 'Open').length;
  document.getElementById('stat-progress').textContent = tickets.filter(t => t.status === 'In Progress').length;
  document.getElementById('stat-resolved').textContent = tickets.filter(t => t.status === 'Resolved').length;
}

function getStatusBadgeClass(status) {
  switch (status) {
    case 'Open': return 'bg-yellow-100 text-yellow-800';
    case 'In Progress': return 'bg-blue-100 text-blue-800';
    case 'Resolved': return 'bg-green-100 text-green-800';
    case 'Closed': return 'bg-gray-100 text-gray-800';
    default: return 'bg-gray-100 text-gray-800';
  }
}

function getPriorityBadgeClass(priority) {
  switch (priority) {
    case 'Urgent': return 'bg-red-100 text-red-700';
    case 'High': return 'bg-orange-100 text-orange-700';
    case 'Medium': return 'bg-blue-100 text-blue-700';
    case 'Low': return 'bg-gray-100 text-gray-600';
    default: return 'bg-gray-100 text-gray-600';
  }
}