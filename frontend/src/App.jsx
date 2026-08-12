import { useState, useEffect } from "react";
import "bootstrap/dist/css/bootstrap.min.css";

const API_URL = "http://127.0.0.1:8000/api/trials";
const STATS_URL = "http://127.0.0.1:8000/api/trials/stats"; // <-- Needed for the dashboard

export default function App() {
  // --- STATE ---
  const [trials, setTrials] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [formData, setFormData] = useState({
    id: "",
    title: "",
    phase: "",
    status: "Active",
  });

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20; 

  // Dashboard State
  const [stats, setStats] = useState([]);
  const [rateLimitMsg, setRateLimitMsg] = useState("");

  // --- EFFECTS ---
  
  // 1. Load Dashboard stats ONCE when page loads
  useEffect(() => {
    loadStats();
  }, []);

  // 2. Watch current page and search term
  useEffect(() => {
    const delaySearch = setTimeout(() => {
      loadData(currentPage);
    }, 300);
    return () => clearTimeout(delaySearch);
  }, [currentPage, searchTerm]);


  // --- API CALLS ---
  
  const loadData = async (page = 1) => {
    try {
      const res = await fetch(`${API_URL}?page=${page}&limit=${limit}&search=${searchTerm}`);
      if (res.ok) {
        const result = await res.json();
        setTrials(result.data); 
        setTotalPages(result.total_pages); 
      }
    } catch (err) {
      console.error("Backend offline");
    }
  };

  // --- THIS WAS THE MISSING FUNCTION! ---
  const loadStats = async () => {
    try {
      setRateLimitMsg(""); 
      const res = await fetch(STATS_URL);
      
      if (res.status === 429) {
        setRateLimitMsg("Rate limit exceeded! Please wait a minute before refreshing stats.");
        return;
      }
      
      if (res.ok) {
        setStats(await res.json());
      }
    } catch (err) {
      console.error("Failed to load stats");
    }
  };

  const saveData = async (e) => {
    e.preventDefault(); 
    const method = formData.id ? "PUT" : "POST";
    const url = formData.id ? `${API_URL}/${formData.id}` : API_URL;

    try {
      await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });
      setShowModal(false);
      loadData(currentPage);
      loadStats(); // Refresh stats when data changes
    } catch (err) {
      alert("Error saving data");
    }
  };

  const deleteData = async (id) => {
    if (window.confirm("Delete this trial?")) {
      await fetch(`${API_URL}/${id}`, { method: "DELETE" });
      loadData(currentPage);
      loadStats(); // Refresh stats when data changes
    }
  };

  // --- HANDLERS ---
  const handleSearch = (e) => {
    setSearchTerm(e.target.value);
    setCurrentPage(1);
  };

  return (
    <div className="container mt-5">
      {/* HEADER SECTION */}
      <div className="d-flex justify-content-between align-items-center mb-4">
        <h2>Clinical Trials</h2>
        <input
          type="text"
          className="form-control w-25"
          placeholder="Search all 100,000 records..."
          value={searchTerm}
          onChange={handleSearch}
        />
        <button
          className="btn btn-primary"
          onClick={() => {
            setFormData({ id: "", title: "", phase: "", status: "Active" });
            setShowModal(true);
          }}
        >
          + Add New Trial
        </button>
      </div>

      {/* DASHBOARD WIDGET */}
      <div className="card shadow-sm mb-4 border-primary">
        <div className="card-header bg-primary text-white d-flex justify-content-between align-items-center">
          <h5 className="mb-0">Analytics (Updates every load)</h5>
          <button
            className="btn btn-sm btn-light text-primary"
            onClick={loadStats}
          >
            Refresh Stats
          </button>
        </div>
        <div className="card-body bg-light">
          {rateLimitMsg && (
            <div className="alert alert-warning fw-bold text-center">
              ⏳ {rateLimitMsg}
            </div>
          )}

          <div className="row text-center">
            {stats.length === 0 && !rateLimitMsg ? (
              <p className="text-muted mb-0">Loading stats...</p>
            ) : (
              stats.map((stat, idx) => (
                <div key={idx} className="col-md-3 mb-2">
                  <div className="p-3 bg-white border rounded shadow-sm">
                    <h6 className="text-muted text-uppercase small mb-1">
                      {stat.phase} - {stat.status}
                    </h6>
                    <h3 className="mb-0 text-primary">
                      {stat.count.toLocaleString()}
                    </h3>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/* DATA GRID */}
      <div className="card shadow-sm mb-3">
        <table className="table table-hover mb-0">
          <thead className="table-dark">
            <tr>
              <th>ID</th>
              <th>Title</th>
              <th>Phase</th>
              <th>Status</th>
              <th className="text-end">Actions</th>
            </tr>
          </thead>
          <tbody>
            {trials.length === 0 ? (
              <tr>
                <td colSpan="5" className="text-center text-muted py-4">
                  No records or Backend offline
                </td>
              </tr>
            ) : (
              trials.map((trial) => (
                <tr key={trial.id}>
                  <td>{trial.id}</td>
                  <td>{trial.title}</td>
                  <td>{trial.phase}</td>
                  <td>
                    <span
                      className={`badge bg-${trial.status === "Active" ? "success" : "secondary"}`}
                    >
                      {trial.status}
                    </span>
                  </td>
                  <td className="text-end">
                    <button
                      className="btn btn-sm btn-outline-primary me-2"
                      onClick={() => {
                        setFormData(trial);
                        setShowModal(true);
                      }}
                    >
                      Edit
                    </button>
                    <button
                      className="btn btn-sm btn-outline-danger"
                      onClick={() => deleteData(trial.id)}
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* PAGINATION CONTROLS */}
      <div className="d-flex justify-content-between align-items-center mb-5">
        <button
          className="btn btn-outline-primary"
          disabled={currentPage === 1}
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
        >
          &larr; Previous
        </button>

        <span className="text-muted fw-bold">
          Page {currentPage} of {totalPages}
        </span>

        <button
          className="btn btn-outline-primary"
          disabled={currentPage === totalPages || totalPages === 0}
          onClick={() => setCurrentPage((prev) => prev + 1)}
        >
          Next &rarr;
        </button>
      </div>

      {/* REACT MODAL (ADD/EDIT) */}
      {showModal && (
        <div
          className="modal show d-block"
          style={{ background: "rgba(0,0,0,0.5)" }}
        >
          <div className="modal-dialog">
            <div className="modal-content">
              <form onSubmit={saveData}>
                <div className="modal-header">
                  <h5 className="modal-title">
                    {formData.id ? "Edit" : "Add"} Trial
                  </h5>
                  <button
                    type="button"
                    className="btn-close"
                    onClick={() => setShowModal(false)}
                  ></button>
                </div>
                <div className="modal-body">
                  <div className="mb-3">
                    <label>Title</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.title}
                      onChange={(e) =>
                        setFormData({ ...formData, title: e.target.value })
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label>Phase</label>
                    <input
                      type="text"
                      className="form-control"
                      required
                      value={formData.phase}
                      onChange={(e) =>
                        setFormData({ ...formData, phase: e.target.value })
                      }
                    />
                  </div>
                  <div className="mb-3">
                    <label>Status</label>
                    <select
                      className="form-select"
                      value={formData.status}
                      onChange={(e) =>
                        setFormData({ ...formData, status: e.target.value })
                      }
                    >
                      <option>Active</option>
                      <option>Pending</option>
                      <option>Completed</option>
                      <option>Recruiting</option>
                    </select>
                  </div>
                </div>
                <div className="modal-footer">
                  <button
                    type="button"
                    className="btn btn-secondary"
                    onClick={() => setShowModal(false)}
                  >
                    Cancel
                  </button>
                  <button type="submit" className="btn btn-success">
                    Save
                  </button>
                </div>
              </form>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}