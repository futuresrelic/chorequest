<?php
error_reporting(E_ALL);
ini_set('display_errors', 1);

echo "<h1>Direct API Login Test</h1>";

// Simulate the exact API call
$_SERVER['REQUEST_METHOD'] = 'POST';
$_SERVER['CONTENT_TYPE'] = 'application/json';

// Create the input
$testData = [
    'action' => 'admin_login',
    'email' => 'klindakoil@gmail.com',  // Replace with your actual email
    'password' => 'M@nd3lbr0t'     // Replace with your actual password
];

// Write to php://input simulation
$inputJSON = json_encode($testData);

// Temporarily create a file to simulate php://input
file_put_contents('/tmp/php_input', $inputJSON);
stream_wrapper_unregister("php");
stream_wrapper_register("php", "MockPhpStream");

class MockPhpStream {
    protected $position;
    protected $data;
    
    function stream_open($path, $mode, $options, &$opened_path) {
        if ($path === 'php://input') {
            $this->data = file_get_contents('/tmp/php_input');
            $this->position = 0;
            return true;
        }
        return false;
    }
    
    function stream_read($count) {
        $ret = substr($this->data, $this->position, $count);
        $this->position += strlen($ret);
        return $ret;
    }
    
    function stream_eof() {
        return $this->position >= strlen($this->data);
    }
    
    function stream_stat() {
        return [];
    }
}

echo "<h3>Testing with data:</h3>";
echo "<pre>" . htmlspecialchars($inputJSON) . "</pre>";

echo "<h3>API Response:</h3>";

// Capture output
ob_start();

try {
    include __DIR__ . '/api/api.php';
} catch (Throwable $e) {
    ob_end_clean();
    echo "<pre style='color: red; background: #fee;'>";
    echo "ERROR: " . $e->getMessage() . "\n\n";
    echo "File: " . $e->getFile() . "\n";
    echo "Line: " . $e->getLine() . "\n\n";
    echo "Stack trace:\n" . $e->getTraceAsString();
    echo "</pre>";
    exit;
}

$output = ob_get_clean();

echo "<pre style='background: #efe;'>";
echo htmlspecialchars($output);
echo "</pre>";

// Decode JSON
$result = json_decode($output, true);
if ($result) {
    echo "<h3>Parsed JSON:</h3>";
    echo "<pre>" . print_r($result, true) . "</pre>";
} else {
    echo "<p style='color: red;'>Failed to parse JSON response</p>";
}
?>