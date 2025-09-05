'use client';

import React, { useState, useRef, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

import { vaultStorage } from '@/lib/storage';
import { encryptionManager } from '@/lib/encryption';
import { VaultFile, FileUploadProgress } from '@/types';

interface FileManagerProps {
  files: VaultFile[];
  currentPin: string;
  onFilesUpdate: (files: VaultFile[]) => void;
}

export function FileManager({ files, currentPin, onFilesUpdate }: FileManagerProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [uploadProgress, setUploadProgress] = useState<FileUploadProgress[]>([]);
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<VaultFile | null>(null);
  const [error, setError] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const filteredFiles = files.filter(file => {
    const matchesSearch = !searchQuery || 
      file.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      file.type.toLowerCase().includes(searchQuery.toLowerCase());
    
    const matchesCategory = selectedCategory === 'all' || 
      (selectedCategory === 'images' && file.type.startsWith('image/')) ||
      (selectedCategory === 'documents' && (
        file.type.includes('pdf') || 
        file.type.includes('doc') || 
        file.type.includes('text/')
      )) ||
      (selectedCategory === 'videos' && file.type.startsWith('video/')) ||
      (selectedCategory === 'audio' && file.type.startsWith('audio/')) ||
      (selectedCategory === 'other' && !['image/', 'video/', 'audio/'].some(type => file.type.startsWith(type)) && !file.type.includes('pdf') && !file.type.includes('doc'));
    
    return matchesSearch && matchesCategory;
  });

  const handleFileUpload = useCallback(async (fileList: FileList) => {
    const filesToUpload = Array.from(fileList);
    
    if (filesToUpload.length === 0) return;
    
    setError('');
    
    for (const file of filesToUpload) {
      const fileId = encryptionManager.generateSecureId();
      
      // Add to upload progress
      setUploadProgress(prev => [...prev, {
        fileId,
        progress: 0,
        status: 'uploading'
      }]);
      
      try {
        // Read file data
        const arrayBuffer = await file.arrayBuffer();
        
        // Update progress
        setUploadProgress(prev => prev.map(p => 
          p.fileId === fileId ? { ...p, progress: 30, status: 'encrypting' } : p
        ));
        
        // Encrypt file data
        const { encryptedData, salt, iv } = await encryptionManager.encryptFile(arrayBuffer, currentPin);
        
        // Update progress
        setUploadProgress(prev => prev.map(p => 
          p.fileId === fileId ? { ...p, progress: 70 } : p
        ));
        
        // Create vault file object
        const vaultFile: VaultFile = {
          id: fileId,
          name: file.name,
          size: file.size,
          type: file.type,
          uploadDate: new Date(),
          encryptedData,
          category: getCategoryFromType(file.type),
          preview: file.type.startsWith('image/') ? await createImagePreview(file) : undefined
        };
        
        // Store encrypted metadata
        const metadata = {
          salt: encryptionManager.arrayBufferToBase64(salt.buffer),
          iv: encryptionManager.arrayBufferToBase64(iv.buffer)
        };
        await vaultStorage.setMetadata(`file_${fileId}`, metadata);
        
        // Store file in vault
        await vaultStorage.storeFile(vaultFile);
        
        // Update progress
        setUploadProgress(prev => prev.map(p => 
          p.fileId === fileId ? { ...p, progress: 100, status: 'complete' } : p
        ));
        
        // Update files list
        const updatedFiles = await vaultStorage.getAllFiles();
        onFilesUpdate(updatedFiles);
        
      } catch (error) {
        console.error('File upload failed:', error);
        setUploadProgress(prev => prev.map(p => 
          p.fileId === fileId ? { ...p, status: 'error', error: 'Upload failed' } : p
        ));
      }
    }
    
    // Clear completed uploads after 2 seconds
    setTimeout(() => {
      setUploadProgress(prev => prev.filter(p => p.status !== 'complete' && p.status !== 'error'));
    }, 2000);
  }, [currentPin, onFilesUpdate]);

  const createImagePreview = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => resolve(e.target?.result as string);
      reader.readAsDataURL(file);
    });
  };

  const getCategoryFromType = (type: string): string => {
    if (type.startsWith('image/')) return 'images';
    if (type.startsWith('video/')) return 'videos';
    if (type.startsWith('audio/')) return 'audio';
    if (type.includes('pdf') || type.includes('doc') || type.startsWith('text/')) return 'documents';
    return 'other';
  };

  const handleDownload = async (file: VaultFile) => {
    try {
      setError('');
      
      // Get encryption metadata
      const metadata = await vaultStorage.getMetadata(`file_${file.id}`);
      if (!metadata) {
        throw new Error('File metadata not found');
      }
      
      // Decrypt file data
      const decryptedData = await encryptionManager.decryptFile(
        file.encryptedData,
        currentPin,
        new Uint8Array(encryptionManager.base64ToArrayBuffer(metadata.salt)),
        new Uint8Array(encryptionManager.base64ToArrayBuffer(metadata.iv))
      );
      
      // Create blob and download
      const blob = new Blob([decryptedData], { type: file.type });
      const url = URL.createObjectURL(blob);
      
      const a = document.createElement('a');
      a.href = url;
      a.download = file.name;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      
      URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error('Download failed:', error);
      setError('Failed to download file. Please check your PIN.');
    }
  };

  const handleDelete = async (file: VaultFile) => {
    if (confirm(`Are you sure you want to delete "${file.name}"?`)) {
      try {
        await vaultStorage.deleteFile(file.id);
        await vaultStorage.setMetadata(`file_${file.id}`, null); // Clear metadata
        
        const updatedFiles = await vaultStorage.getAllFiles();
        onFilesUpdate(updatedFiles);
        
        if (selectedFile?.id === file.id) {
          setSelectedFile(null);
        }
      } catch (error) {
        console.error('Delete failed:', error);
        setError('Failed to delete file');
      }
    }
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    
    if (e.dataTransfer.files) {
      handleFileUpload(e.dataTransfer.files);
    }
  };

  const categories = [
    { value: 'all', label: 'All Files' },
    { value: 'images', label: 'Images' },
    { value: 'documents', label: 'Documents' },
    { value: 'videos', label: 'Videos' },
    { value: 'audio', label: 'Audio' },
    { value: 'other', label: 'Other' }
  ];

  const totalSize = files.reduce((acc, file) => acc + file.size, 0);

  return (
    <div className="space-y-6">
      {/* Upload Area */}
      <Card className={`transition-all duration-200 ${dragOver ? 'border-blue-400 bg-blue-50/50' : 'border-white/20'} bg-white/10 backdrop-blur-sm`}>
        <CardContent className="p-6">
          <div
            className={`border-2 border-dashed rounded-lg p-8 text-center transition-all duration-200 ${
              dragOver ? 'border-blue-400 bg-blue-50/30' : 'border-white/30'
            }`}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="space-y-4">
              <div className="mx-auto w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
                <div className="w-8 h-8 text-white">⬆</div>
              </div>
              
              <div>
                <p className="text-white font-medium mb-2">
                  Drag and drop files here, or click to select
                </p>
                <p className="text-white/70 text-sm">
                  All files are encrypted before storage
                </p>
              </div>
              
              <Button
                onClick={() => fileInputRef.current?.click()}
                className="bg-white/20 hover:bg-white/30 text-white border-white/30"
                variant="outline"
              >
                Choose Files
              </Button>
              
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={(e) => e.target.files && handleFileUpload(e.target.files)}
              />
            </div>
          </div>

          {/* Upload Progress */}
          {uploadProgress.length > 0 && (
            <div className="mt-4 space-y-2">
              {uploadProgress.map((upload) => (
                <div key={upload.fileId} className="space-y-1">
                  <div className="flex justify-between text-sm text-white">
                    <span className="capitalize">{upload.status}</span>
                    <span>{upload.progress}%</span>
                  </div>
                  <Progress value={upload.progress} className="h-1" />
                  {upload.error && (
                    <p className="text-red-400 text-xs">{upload.error}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Controls */}
      <div className="flex flex-col sm:flex-row gap-4">
        <Input
          placeholder="Search files..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="flex-1 bg-white/10 border-white/20 text-white placeholder:text-white/50"
        />
        
        <Select value={selectedCategory} onValueChange={setSelectedCategory}>
          <SelectTrigger className="w-full sm:w-48 bg-white/10 border-white/20 text-white">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {categories.map(cat => (
              <SelectItem key={cat.value} value={cat.value}>
                {cat.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* File Stats */}
      <div className="flex gap-4 text-white/80 text-sm">
        <Badge variant="secondary" className="bg-white/10 text-white">
          {files.length} files
        </Badge>
        <Badge variant="secondary" className="bg-white/10 text-white">
          {formatFileSize(totalSize)}
        </Badge>
        <Badge variant="secondary" className="bg-white/10 text-white">
          {filteredFiles.length} shown
        </Badge>
      </div>

      {error && (
        <Alert className="border-red-400 bg-red-500/10">
          <AlertDescription className="text-red-400">
            {error}
          </AlertDescription>
        </Alert>
      )}

      {/* Files Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {filteredFiles.map((file) => (
          <Card key={file.id} className="bg-white/10 border-white/20 backdrop-blur-sm hover:bg-white/15 transition-all duration-200">
            <CardHeader className="pb-2">
              <CardTitle className="text-white text-sm font-medium truncate" title={file.name}>
                {file.name}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {file.preview && (
                <div className="aspect-video rounded overflow-hidden bg-white/5">
                  <img 
                    src={file.preview} 
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                </div>
              )}
              
              <div className="space-y-2 text-xs text-white/70">
                <div className="flex justify-between">
                  <span>Size:</span>
                  <span>{formatFileSize(file.size)}</span>
                </div>
                <div className="flex justify-between">
                  <span>Type:</span>
                  <span className="truncate">{file.type}</span>
                </div>
                <div className="flex justify-between">
                  <span>Added:</span>
                  <span>{new Date(file.uploadDate).toLocaleDateString()}</span>
                </div>
              </div>
              
              <div className="flex gap-2 pt-2">
                <Button
                  size="sm"
                  onClick={() => handleDownload(file)}
                  className="flex-1 bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Download
                </Button>
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => handleDelete(file)}
                  className="bg-red-600 hover:bg-red-700"
                >
                  Delete
                </Button>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredFiles.length === 0 && (
        <Card className="bg-white/10 border-white/20 backdrop-blur-sm">
          <CardContent className="p-8 text-center">
            <p className="text-white/70">
              {files.length === 0 
                ? 'No files in vault. Upload some files to get started!'
                : 'No files match your search criteria.'
              }
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}