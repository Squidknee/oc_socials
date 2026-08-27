import CreateWorldForm from '../components/CreateWorldForm.jsx';

// Dedicated page for creating a world — replaces the toggle-form that used
// to live at the bottom of WorldSelector's list. The app-wide NavBar (logo
// + Log Out) already renders above every route in App.jsx, so this page is
// just the centered card.
export default function CreateWorld() {
  return (
    <div className="page-center">
      <CreateWorldForm />
    </div>
  );
}
