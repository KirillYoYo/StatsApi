const StatsLoader = ({ progress }: { progress?: string }) => {
  return (
    <div
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        width: '100%',
        height: '100%',
        background: 'rgba(0,0,0, 0.1)',
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
      }}
    >
      <span
        style={{
          padding: 20,
          color: '#fff',
          backgroundColor: 'rgba(0,0,0, 0.5)',
        }}
      >
        {progress}
      </span>
    </div>
  );
};

export default StatsLoader;
