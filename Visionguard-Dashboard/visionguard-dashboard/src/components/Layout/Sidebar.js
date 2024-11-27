import React from 'react';
import { NavLink } from 'react-router-dom';

const Sidebar = () => {
  return (
    <aside className="sidebar">
      <NavLink exact to="/" activeClassName="active">
        Dashboard
      </NavLink>
      <NavLink to="/vehicles" activeClassName="active">
        Vehicles
      </NavLink>
      <NavLink to="/parking-spots" activeClassName="active">
        Parking Spots
      </NavLink>
      <NavLink to="/violations" activeClassName="active">
        Violations
      </NavLink>
      <NavLink to="/reports" activeClassName="active">
        Reports
      </NavLink>
      <NavLink to="/settings" activeClassName="active">
        Settings
      </NavLink>
    </aside>
  );
};

export default Sidebar;
